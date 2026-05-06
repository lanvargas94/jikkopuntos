import { Injectable } from '@nestjs/common';
import { NOTIFICATION_TYPE } from '../../common/constants/notification-types';
import { ROLE_CODES } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private appBaseUrl(): string {
    const explicit = process.env.FRONTEND_PUBLIC_URL?.trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    const origins = process.env.FRONTEND_ORIGIN?.split(',') ?? [];
    const first = origins.map((s) => s.trim()).find(Boolean);
    return (first ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  async createInApp(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link ?? undefined,
      },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async listForUser(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!n) {
      return null;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async adminUserIds(): Promise<string[]> {
    const role = await this.prisma.role.findUnique({
      where: { code: ROLE_CODES.ADMIN },
    });
    if (!role) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { roleId: role.id, isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async collaboratorUserIds(): Promise<{ id: string; email: string }[]> {
    const role = await this.prisma.role.findUnique({
      where: { code: ROLE_CODES.COLLABORATOR },
    });
    if (!role) {
      return [];
    }
    return this.prisma.user.findMany({
      where: { roleId: role.id, isActive: true },
      select: { id: true, email: true },
    });
  }

  async onFormPublished(params: {
    formId: string;
    formTitle: string;
    relativePath: string;
  }) {
    const base = this.appBaseUrl();
    const link = `${base}${params.relativePath}`;
    const title = 'Nuevo formulario publicado';
    const body = `Ya puedes responder: «${params.formTitle}».`;
    const collabs = await this.collaboratorUserIds();
    for (const u of collabs) {
      await this.createInApp({
        userId: u.id,
        type: NOTIFICATION_TYPE.FORM_PUBLISHED,
        title,
        body,
        link: `/formularios`,
      });
      await this.mail.send(
        u.email,
        `[Jikkosoft] ${title}`,
        `${body}\n\nEnlace directo: ${link}\n\nPortal: ${base}`,
      );
    }
  }

  /** Notifica a administradores (bandeja unificada de aprobaciones RR.HH.). */
  async onApprovalPending(params: {
    summaryLine: string;
    excludeNotifierUserId?: string;
  }) {
    const base = this.appBaseUrl();
    const link = `${base}/admin/aprobaciones`;
    const title = 'Solicitud pendiente de aprobación';
    const body = params.summaryLine;
    const admins = await this.adminUserIds();
    for (const id of admins) {
      if (id === params.excludeNotifierUserId) {
        continue;
      }
      await this.createInApp({
        userId: id,
        type: NOTIFICATION_TYPE.APPROVAL_PENDING,
        title,
        body,
        link: '/admin/aprobaciones',
      });
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { email: true },
      });
      if (user) {
        await this.mail.send(
          user.email,
          `[Jikkosoft] ${title}`,
          `${body}\n\nRevisa la bandeja: ${link}`,
        );
      }
    }
  }

  async onApprovalResolved(params: {
    userId: string;
    email: string;
    detail: string;
    decision: 'approved' | 'rejected';
    newBalance?: number;
  }) {
    const approved = params.decision === 'approved';
    const title = approved ? 'Solicitud aprobada' : 'Solicitud rechazada';
    const type = approved
      ? NOTIFICATION_TYPE.APPROVAL_APPROVED
      : NOTIFICATION_TYPE.APPROVAL_REJECTED;
    const body =
      approved && params.newBalance !== undefined
        ? `${params.detail} Nuevo saldo: ${params.newBalance.toLocaleString('es-CO')} JP.`
        : params.detail;
    const path = '/mis-solicitudes';
    await this.createInApp({
      userId: params.userId,
      type,
      title,
      body,
      link: path,
    });
    await this.mail.send(
      params.email,
      `[Jikkosoft] ${title}`,
      `${body}\n\n${this.appBaseUrl()}${path}`,
    );
  }

  async onJpCredit(params: {
    userId: string;
    email: string;
    amount: number;
    reasonLine: string;
    minAmount: number;
  }) {
    if (params.amount < params.minAmount) {
      return;
    }
    const title = 'Nuevo abono de jikkopuntos';
    const body = `${params.reasonLine} (+${params.amount.toLocaleString('es-CO')} JP).`;
    await this.createInApp({
      userId: params.userId,
      type: NOTIFICATION_TYPE.JP_BALANCE_CREDIT,
      title,
      body,
      link: '/jikkopuntos',
    });
    await this.mail.send(
      params.email,
      `[Jikkosoft] ${title}`,
      `${body}\n\nConsulta tu historial en ${this.appBaseUrl()}/jikkopuntos`,
    );
  }
}
