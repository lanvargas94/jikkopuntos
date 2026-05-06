import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { PASSWORD_HISTORY_DEPTH } from '../../common/security/password-history.constants';
import {
  PASSWORD_POLICY_HINT,
  validatePasswordPolicy,
} from '../../common/security/password-policy';
import {
  SECURITY_AUDIT_ACTION,
  type PasswordChangeRejectReason,
} from '../../common/security/security-audit.constants';
import type { AuditRequestContext } from '../../common/http/request-audit.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../notifications/mail.service';
import { UsersService } from '../users/users.service';
import { JWT_REFRESH } from './auth.constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type UserForTokens = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  role: { code: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly accessJwt: JwtService,
    @Inject(JWT_REFRESH) private readonly refreshJwt: JwtService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  private mapUserPublic(user: UserForTokens) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleCode: user.role.code,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async logPasswordRejected(
    userId: string,
    reason: PasswordChangeRejectReason,
  ) {
    await this.audit.logSecurityEvent({
      userId,
      actorUserId: userId,
      action: SECURITY_AUDIT_ACTION.PASSWORD_CHANGE_REJECTED,
      metadata: { reason },
    });
  }

  private refreshTtlMs(): number {
    const sec = Number(
      this.config.get<string>('JWT_REFRESH_EXPIRES_SEC') ?? 604800,
    );
    return sec * 1000;
  }

  private async issueTokenPair(user: UserForTokens) {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        expiresAt,
      },
    });
    const [accessToken, refreshToken] = await Promise.all([
      this.accessJwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role.code,
      }),
      this.refreshJwt.signAsync({
        sub: user.id,
        jti,
        typ: 'refresh',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private loginEmailFingerprint(email: string) {
    return createHash('sha256').update(email).digest('hex').slice(0, 16);
  }

  async login(dto: LoginDto, ctx?: AuditRequestContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user) {
      this.logger.warn(
        `login failed: usuario no encontrado (emailFp=${this.loginEmailFingerprint(email)})`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      await this.audit.logSecurityEvent({
        userId: user.id,
        actorUserId: user.id,
        action: SECURITY_AUDIT_ACTION.AUTH_LOGIN_BLOCKED_INACTIVE,
        context: ctx,
        metadata: { reason: 'INACTIVE_ACCOUNT' },
      });
      throw new UnauthorizedException('Usuario inactivo');
    }
    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) {
      await this.audit.logSecurityEvent({
        userId: user.id,
        actorUserId: user.id,
        action: SECURITY_AUDIT_ACTION.AUTH_LOGIN_FAILED_CREDENTIALS,
        context: ctx,
        metadata: { reason: 'BAD_PASSWORD' },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const u = user as UserForTokens;
    const { accessToken, refreshToken } = await this.issueTokenPair(u);
    await this.audit.logSecurityEvent({
      userId: user.id,
      actorUserId: user.id,
      action: SECURITY_AUDIT_ACTION.AUTH_LOGIN_SUCCESS,
      context: ctx,
      metadata: { roleCode: u.role.code },
    });
    return {
      accessToken,
      refreshToken,
      user: this.mapUserPublic(u),
    };
  }

  async refresh(dto: RefreshTokenDto) {
    interface RefreshPayload {
      sub: string;
      jti: string;
      typ?: string;
    }
    let payload: RefreshPayload;
    try {
      payload = await this.refreshJwt.verifyAsync<RefreshPayload>(
        dto.refreshToken,
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token inválido o expirado. Vuelve a iniciar sesión.',
      );
    }
    if (payload.typ !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Token de actualización inválido');
    }
    const row = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: { user: { include: { role: true } } },
    });
    if (!row || row.revokedAt) {
      throw new UnauthorizedException(
        'Sesión revocada o inexistente. Vuelve a iniciar sesión.',
      );
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesión expirada. Vuelve a iniciar sesión.');
    }
    const u = row.user;
    if (!u.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    const userForTokens = u as UserForTokens;
    const { accessToken, refreshToken } = await this.issueTokenPair(userForTokens);
    return {
      accessToken,
      refreshToken,
      user: this.mapUserPublic(userForTokens),
    };
  }

  async logout(refreshTokenPlain?: string) {
    if (!refreshTokenPlain?.length) {
      return { ok: true };
    }
    try {
      const payload = await this.refreshJwt.verifyAsync<{
        jti?: string;
        typ?: string;
      }>(refreshTokenPlain);
      if (payload.typ === 'refresh' && payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      /* token ya inválido: idempotente */
    }
    return { ok: true };
  }

  async revokeAllRefreshSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(user: JwtUserPayload, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      await this.logPasswordRejected(user.userId, 'MISMATCH_CONFIRM');
      throw new BadRequestException(
        'La confirmación no coincide con la nueva contraseña',
      );
    }

    const policyMsg = validatePasswordPolicy(dto.newPassword);
    if (policyMsg) {
      await this.logPasswordRejected(user.userId, 'POLICY_VIOLATION');
      throw new BadRequestException(
        `${policyMsg} ${PASSWORD_POLICY_HINT}`,
      );
    }

    if (dto.newPassword === dto.currentPassword) {
      await this.logPasswordRejected(user.userId, 'SAME_AS_CURRENT');
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });

    const currentOk = await bcrypt.compare(
      dto.currentPassword,
      full.passwordHash,
    );
    if (!currentOk) {
      await this.logPasswordRejected(user.userId, 'WRONG_CURRENT');
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const history = await this.prisma.passwordHistory.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_DEPTH,
    });
    for (const row of history) {
      const reused = await bcrypt.compare(dto.newPassword, row.hash);
      if (reused) {
        await this.logPasswordRejected(user.userId, 'REUSED_PASSWORD');
        throw new BadRequestException(
          'No puedes reutilizar una contraseña anterior (incluye la contraseña temporal inicial).',
        );
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    const oldHash = full.passwordHash;
    const uid = user.userId;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: uid, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.passwordHistory.create({
        data: { userId: uid, hash: oldHash },
      });

      const rows = await tx.passwordHistory.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
      });
      const excess = rows.slice(PASSWORD_HISTORY_DEPTH);
      if (excess.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: excess.map((r) => r.id) } },
        });
      }

      await tx.user.update({
        where: { id: uid },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
        },
      });

      await this.audit.logSecurityEventTx(tx, {
        userId: uid,
        actorUserId: uid,
        action: SECURITY_AUDIT_ACTION.PASSWORD_CHANGED,
        metadata: { source: 'self_service' },
      });
    });

    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: uid },
      include: { role: true },
    });
    const pair = await this.issueTokenPair(u as UserForTokens);
    return {
      ok: true,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  getMe(userId: string) {
    return this.users.getMe(userId);
  }

  private frontendPublicBase(): string {
    const explicit = this.config.get<string>('FRONTEND_PUBLIC_URL')?.trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    const origins = this.config.get<string>('FRONTEND_ORIGIN')?.split(',') ?? [];
    const first = origins.map((s) => s.trim()).find(Boolean);
    return (first ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  async forgotPassword(dto: ForgotPasswordDto, ctx?: AuditRequestContext) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user || !user.isActive) {
      this.logger.warn(
        `password reset requested for unknown/inactive (emailFp=${this.loginEmailFingerprint(email)})`,
      );
      return { ok: true };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresMin = Number(
      this.config.get<string>('PASSWORD_RESET_EXPIRES_MIN') ?? 60,
    );
    const ttl = Number.isFinite(expiresMin) && expiresMin > 0 ? expiresMin : 60;
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttl * 60_000),
      },
    });

    const base = this.frontendPublicBase();
    const link = `${base}/restablecer-clave?token=${encodeURIComponent(raw)}`;

    if (this.mail.isEnabled()) {
      await this.mail.send(
        user.email,
        '[Jikkosoft] Restablecer contraseña',
        `Hola ${user.firstName},\n\n` +
          `Recibimos una solicitud para restablecer la contraseña de tu cuenta en el portal Jikkosoft.\n\n` +
          `Abre este enlace (válido ${ttl} minutos):\n${link}\n\n` +
          `Si no fuiste tú, ignora este mensaje.\n`,
      );
    } else {
      this.logger.warn(
        'SMTP no configurado: no se envió correo de recuperación. Configura SMTP_HOST.',
      );
    }

    await this.audit.logSecurityEvent({
      userId: user.id,
      actorUserId: user.id,
      action: SECURITY_AUDIT_ACTION.PASSWORD_RESET_REQUESTED,
      context: ctx,
      metadata: { emailSent: this.mail.isEnabled() },
    });

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException(
        'La confirmación no coincide con la nueva contraseña',
      );
    }
    const policyMsg = validatePasswordPolicy(dto.newPassword);
    if (policyMsg) {
      throw new BadRequestException(`${policyMsg} ${PASSWORD_POLICY_HINT}`);
    }

    const tokenHash = createHash('sha256').update(dto.token.trim()).digest('hex');
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() < Date.now() ||
      !row.user.isActive
    ) {
      throw new BadRequestException(
        'El enlace no es válido o ha expirado. Solicita uno nuevo desde «Olvidé mi contraseña».',
      );
    }

    const uid = row.userId;
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_DEPTH,
    });
    for (const h of history) {
      const reused = await bcrypt.compare(dto.newPassword, h.hash);
      if (reused) {
        throw new BadRequestException(
          'No puedes reutilizar una contraseña anterior.',
        );
      }
    }
    const sameAsCurrent = await bcrypt.compare(
      dto.newPassword,
      row.user.passwordHash,
    );
    if (sameAsCurrent) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual.',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    const oldHash = row.user.passwordHash;

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: uid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordHistory.create({
        data: { userId: uid, hash: oldHash },
      });
      const rows = await tx.passwordHistory.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
      });
      const excess = rows.slice(PASSWORD_HISTORY_DEPTH);
      if (excess.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: excess.map((r) => r.id) } },
        });
      }
      await tx.user.update({
        where: { id: uid },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
        },
      });
      await this.audit.logSecurityEventTx(tx, {
        userId: uid,
        actorUserId: uid,
        action: SECURITY_AUDIT_ACTION.PASSWORD_CHANGED,
        metadata: { source: 'password_reset' },
      });
    });

    await this.audit.logSecurityEvent({
      userId: uid,
      actorUserId: uid,
      action: SECURITY_AUDIT_ACTION.PASSWORD_RESET_COMPLETED,
    });

    return { ok: true };
  }
}
