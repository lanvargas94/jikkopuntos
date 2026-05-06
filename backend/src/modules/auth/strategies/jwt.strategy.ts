import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ROLE_CODES, type RoleCode } from '../../../common/constants/roles';
import { JwtUserPayload } from '../../../common/interfaces/jwt-user-payload.interface';
import { PrismaService } from '../../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ??
        config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException('Usuario inactivo o no encontrado');
    }
    if (user.role.code !== payload.role) {
      throw new UnauthorizedException('Sesión desactualizada; vuelve a iniciar sesión');
    }
    const roleCode = user.role.code;
    if (
      roleCode !== ROLE_CODES.ADMIN &&
      roleCode !== ROLE_CODES.COLLABORATOR
    ) {
      throw new UnauthorizedException('Rol no reconocido');
    }
    return {
      userId: user.id,
      email: user.email,
      roleCode: roleCode as RoleCode,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
