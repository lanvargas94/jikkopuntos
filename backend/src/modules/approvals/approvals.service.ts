import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  APPROVAL_CATEGORY,
  APPROVAL_STATUS,
  LEAVE_KIND_LABEL,
} from '../../common/constants/approval-request';
import {
  JIKKO_MOVEMENT_TYPE,
  JIKKO_SOURCE_TYPE,
} from '../../common/constants/jikkopoint-movement';
import { REDEMPTION_TYPE } from '../../common/constants/redemption-request';
import { ROLE_CODES } from '../../common/constants/roles';
import { SECURITY_AUDIT_ACTION } from '../../common/security/security-audit.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  REDEEM_REST_CONFIG,
  type RedeemRestKind,
} from '../jikkopoints/constants/redeem-rest';
import type { CreateLeaveDto } from './dto/create-leave.dto';

/** Interpreta YYYY-MM-DD como fecha local (evita desfases UTC). */
function parseYmdLocal(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

function todayLocalMidnight(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const listInclude = {
  targetUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  jikkopuntosDetail: true,
  leaveDetail: true,
  medicalLeaveDetail: true,
} as const;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private selfApproveAllowed(): boolean {
    return process.env.REDEMPTION_ALLOW_SELF_APPROVE === '1';
  }

  private async computeLedgerBalance(userId: string): Promise<number> {
    const agg = await this.prisma.jikkoPointTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  private async ensureAccount(userId: string) {
    await this.prisma.jikkoPointAccount.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });
  }

  private async reconcileAccountCache(
    userId: string,
    ledgerBalance: number,
  ): Promise<boolean> {
    const acc = await this.prisma.jikkoPointAccount.findUnique({
      where: { userId },
    });
    if (!acc || acc.balance === ledgerBalance) {
      return false;
    }
    await this.prisma.jikkoPointAccount.update({
      where: { userId },
      data: { balance: ledgerBalance },
    });
    return true;
  }

  async createJikkopuntosBenefitPending(params: {
    targetUserId: string;
    requestedByUserId: string;
    tierId: string;
    jp: number;
    justification: string;
    attachmentPath: string;
  }) {
    const created = await this.prisma.approvalRequest.create({
      data: {
        category: APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION,
        status: APPROVAL_STATUS.PENDING,
        targetUserId: params.targetUserId,
        requestedByUserId: params.requestedByUserId,
        justification: params.justification,
        attachmentPath: params.attachmentPath,
        jikkopuntosDetail: {
          create: {
            redemptionType: REDEMPTION_TYPE.BENEFIT,
            benefitTierId: params.tierId,
            jpAmount: params.jp,
          },
        },
      },
    });
    await this.audit.logSecurityEvent({
      userId: params.targetUserId,
      actorUserId: params.requestedByUserId,
      action: SECURITY_AUDIT_ACTION.REDEMPTION_REQUESTED,
      metadata: {
        requestId: created.id,
        type: REDEMPTION_TYPE.BENEFIT,
        tierId: params.tierId,
        jp: params.jp,
      },
    });

    const tier = await this.prisma.benefitRewardTier.findUnique({
      where: { id: params.tierId },
      select: { label: true },
    });
    const u = await this.prisma.user.findUnique({
      where: { id: params.targetUserId },
      select: { firstName: true, lastName: true },
    });
    const summary = `${u?.firstName ?? ''} ${u?.lastName ?? ''} solicitó el beneficio «${tier?.label ?? '—'}» (${params.jp} JP).`;
    await this.notifications.onApprovalPending({
      summaryLine: summary.trim(),
    });

    return created;
  }

  async createJikkopuntosRestPending(params: {
    targetUserId: string;
    requestedByUserId: string;
    kind: RedeemRestKind;
    jp: number;
    justification: string;
    attachmentPath: string;
  }) {
    const created = await this.prisma.approvalRequest.create({
      data: {
        category: APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION,
        status: APPROVAL_STATUS.PENDING,
        targetUserId: params.targetUserId,
        requestedByUserId: params.requestedByUserId,
        justification: params.justification,
        attachmentPath: params.attachmentPath,
        jikkopuntosDetail: {
          create: {
            redemptionType: REDEMPTION_TYPE.REST,
            restKind: params.kind,
            jpAmount: params.jp,
          },
        },
      },
    });
    await this.audit.logSecurityEvent({
      userId: params.targetUserId,
      actorUserId: params.requestedByUserId,
      action: SECURITY_AUDIT_ACTION.REDEMPTION_REQUESTED,
      metadata: {
        requestId: created.id,
        type: REDEMPTION_TYPE.REST,
        kind: params.kind,
        jp: params.jp,
      },
    });

    const cfg = REDEEM_REST_CONFIG[params.kind];
    const admin = await this.prisma.user.findUnique({
      where: { id: params.requestedByUserId },
      select: { firstName: true, lastName: true },
    });
    const target = await this.prisma.user.findUnique({
      where: { id: params.targetUserId },
      select: { firstName: true, lastName: true },
    });
    const summary = `${admin?.firstName ?? ''} ${admin?.lastName ?? ''} registró un canje de descanso (${cfg.label}, ${params.jp} JP) para ${target?.firstName ?? ''} ${target?.lastName ?? ''}.`;
    await this.notifications.onApprovalPending({
      summaryLine: summary.trim(),
      excludeNotifierUserId: params.requestedByUserId,
    });

    return created;
  }

  async createLeaveRequest(userId: string, roleCode: string, dto: CreateLeaveDto) {
    if (roleCode !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException('Solo colaboradores pueden solicitar permisos.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user?.isActive || user.role.code !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException('Operación no permitida.');
    }
    const start = parseYmdLocal(dto.startDate);
    const end = parseYmdLocal(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Fechas no válidas.');
    }
    if (end < start) {
      throw new BadRequestException('La fecha fin debe ser posterior o igual al inicio.');
    }
    const today = todayLocalMidnight();
    if (start < today || end < today) {
      throw new BadRequestException(
        'Las fechas de permiso no pueden ser anteriores al día de hoy.',
      );
    }

    const created = await this.prisma.approvalRequest.create({
      data: {
        category: APPROVAL_CATEGORY.LEAVE_PERMISSION,
        status: APPROVAL_STATUS.PENDING,
        targetUserId: userId,
        requestedByUserId: userId,
        justification: dto.justification.trim(),
        leaveDetail: {
          create: {
            leaveKind: dto.leaveKind,
            startDate: start,
            endDate: end,
            notes: dto.notes?.trim() || null,
          },
        },
      },
    });

    await this.audit.logSecurityEvent({
      userId,
      actorUserId: userId,
      action: SECURITY_AUDIT_ACTION.APPROVAL_SUBMITTED,
      metadata: { requestId: created.id, category: APPROVAL_CATEGORY.LEAVE_PERMISSION },
    });

    const kindLabel = LEAVE_KIND_LABEL[dto.leaveKind] ?? dto.leaveKind;
    await this.notifications.onApprovalPending({
      summaryLine: `${user.firstName} ${user.lastName} solicitó permiso (${kindLabel}) del ${start.toLocaleDateString('es-CO')} al ${end.toLocaleDateString('es-CO')}.`,
    });

    return { requestId: created.id, status: APPROVAL_STATUS.PENDING };
  }

  async createMedicalLeaveRequest(
    userId: string,
    roleCode: string,
    params: {
      startDate: string;
      endDate: string;
      clinicalSummary?: string;
      justification?: string;
      attachmentRelativePath: string;
    },
  ) {
    if (roleCode !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException('Solo colaboradores pueden reportar incapacidades.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user?.isActive || user.role.code !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException('Operación no permitida.');
    }
    const start = parseYmdLocal(params.startDate);
    const end = parseYmdLocal(params.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Fechas no válidas.');
    }
    if (end < start) {
      throw new BadRequestException('La fecha fin debe ser posterior o igual al inicio.');
    }
    const today = todayLocalMidnight();
    const minMedical = new Date(today);
    minMedical.setDate(minMedical.getDate() - 30);
    if (start < minMedical || end < minMedical) {
      throw new BadRequestException(
        'Las fechas de incapacidad no pueden ser anteriores a hace 30 días.',
      );
    }

    const created = await this.prisma.approvalRequest.create({
      data: {
        category: APPROVAL_CATEGORY.MEDICAL_LEAVE,
        status: APPROVAL_STATUS.PENDING,
        targetUserId: userId,
        requestedByUserId: userId,
        justification: params.justification?.trim() || null,
        attachmentPath: params.attachmentRelativePath,
        medicalLeaveDetail: {
          create: {
            startDate: start,
            endDate: end,
            clinicalSummary: params.clinicalSummary?.trim() || null,
          },
        },
      },
    });

    await this.audit.logSecurityEvent({
      userId,
      actorUserId: userId,
      action: SECURITY_AUDIT_ACTION.APPROVAL_SUBMITTED,
      metadata: { requestId: created.id, category: APPROVAL_CATEGORY.MEDICAL_LEAVE },
    });

    await this.notifications.onApprovalPending({
      summaryLine: `${user.firstName} ${user.lastName} cargó una incapacidad médica (${start.toLocaleDateString('es-CO')} – ${end.toLocaleDateString('es-CO')}).`,
    });

    return { requestId: created.id, status: APPROVAL_STATUS.PENDING };
  }

  async listAdmin(status?: string, category?: string) {
    const st =
      status === APPROVAL_STATUS.PENDING ||
      status === APPROVAL_STATUS.APPROVED ||
      status === APPROVAL_STATUS.REJECTED
        ? status
        : undefined;
    const cat =
      category === APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION ||
      category === APPROVAL_CATEGORY.LEAVE_PERMISSION ||
      category === APPROVAL_CATEGORY.MEDICAL_LEAVE
        ? category
        : undefined;

    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        ...(st ? { status: st } : {}),
        ...(cat ? { category: cat } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: listInclude,
    });

    const tierIds = [
      ...new Set(
        rows
          .map((r) => r.jikkopuntosDetail?.benefitTierId)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const tiers =
      tierIds.length > 0
        ? await this.prisma.benefitRewardTier.findMany({
            where: { id: { in: tierIds } },
            select: { id: true, label: true },
          })
        : [];
    const tierLabel = new Map(tiers.map((t) => [t.id, t.label]));

    return rows.map((r) => this.serializeListRow(r, tierLabel));
  }

  async listMine(userId: string) {
    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        OR: [{ targetUserId: userId }, { requestedByUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: listInclude,
    });
    const tierIds = [
      ...new Set(
        rows
          .map((r) => r.jikkopuntosDetail?.benefitTierId)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const tiers =
      tierIds.length > 0
        ? await this.prisma.benefitRewardTier.findMany({
            where: { id: { in: tierIds } },
            select: { id: true, label: true },
          })
        : [];
    const tierLabel = new Map(tiers.map((t) => [t.id, t.label]));
    return rows.map((r) => this.serializeListRow(r, tierLabel));
  }

  private serializeListRow(
    r: Prisma.ApprovalRequestGetPayload<{ include: typeof listInclude }>,
    tierLabel: Map<string, string>,
  ) {
    const base = {
      id: r.id,
      category: r.category,
      status: r.status,
      justification: r.justification,
      attachmentPath: r.attachmentPath,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      targetUser: r.targetUser,
      requestedBy: r.requestedBy,
    };

    if (r.jikkopuntosDetail) {
      const d = r.jikkopuntosDetail;
      return {
        ...base,
        detail: {
          kind: 'JIKKOPOINTS_REDEMPTION',
          redemptionType: d.redemptionType,
          jpAmount: d.jpAmount,
          benefitTierId: d.benefitTierId,
          benefitTierLabel: d.benefitTierId
            ? tierLabel.get(d.benefitTierId) ?? null
            : null,
          restKind: d.restKind,
          ledgerTransactionId: d.ledgerTransactionId,
        },
      };
    }
    if (r.leaveDetail) {
      const d = r.leaveDetail;
      return {
        ...base,
        detail: {
          kind: 'LEAVE_PERMISSION',
          leaveKind: d.leaveKind,
          leaveKindLabel: LEAVE_KIND_LABEL[d.leaveKind] ?? d.leaveKind,
          startDate: d.startDate.toISOString(),
          endDate: d.endDate.toISOString(),
          notes: d.notes,
        },
      };
    }
    if (r.medicalLeaveDetail) {
      const d = r.medicalLeaveDetail;
      return {
        ...base,
        detail: {
          kind: 'MEDICAL_LEAVE',
          startDate: d.startDate.toISOString(),
          endDate: d.endDate.toISOString(),
          clinicalSummary: d.clinicalSummary,
        },
      };
    }
    return { ...base, detail: null };
  }

  async approveRequest(requestId: string, approverUserId: string) {
    const row = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        jikkopuntosDetail: true,
        leaveDetail: true,
        medicalLeaveDetail: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (row.status !== APPROVAL_STATUS.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada.');
    }
    if (
      row.requestedByUserId === approverUserId &&
      !this.selfApproveAllowed()
    ) {
      throw new BadRequestException(
        'No puedes aprobar una solicitud que registraste tú mismo. Pide revisión a otro administrador o define REDEMPTION_ALLOW_SELF_APPROVE=1 solo en entornos de prueba.',
      );
    }

    if (row.category === APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION) {
      return this.approveJikkopuntosRequest(row, approverUserId);
    }
    if (
      row.category === APPROVAL_CATEGORY.LEAVE_PERMISSION ||
      row.category === APPROVAL_CATEGORY.MEDICAL_LEAVE
    ) {
      return this.approveNonJpRequest(row, approverUserId);
    }
    throw new BadRequestException('Categoría de solicitud no soportada.');
  }

  private async approveNonJpRequest(
    row: Prisma.ApprovalRequestGetPayload<{
      include: {
        jikkopuntosDetail: true;
        leaveDetail: true;
        medicalLeaveDetail: true;
      };
    }>,
    approverUserId: string,
  ) {
    await this.prisma.approvalRequest.update({
      where: { id: row.id },
      data: {
        status: APPROVAL_STATUS.APPROVED,
        reviewedByUserId: approverUserId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.logSecurityEvent({
      userId: row.targetUserId,
      actorUserId: approverUserId,
      action: SECURITY_AUDIT_ACTION.APPROVAL_APPROVED,
      metadata: { requestId: row.id, category: row.category },
    });

    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.targetUserId },
      select: { email: true, firstName: true, lastName: true },
    });

    const detail =
      row.category === APPROVAL_CATEGORY.LEAVE_PERMISSION
        ? 'Tu solicitud de permiso fue aprobada.'
        : 'Tu reporte de incapacidad fue aprobado.';

    await this.notifications.onApprovalResolved({
      userId: row.targetUserId,
      email: target.email,
      detail,
      decision: 'approved',
    });

    if (row.requestedByUserId !== row.targetUserId) {
      const requester = await this.prisma.user.findUnique({
        where: { id: row.requestedByUserId },
        select: { email: true },
      });
      if (requester) {
        await this.notifications.onApprovalResolved({
          userId: row.requestedByUserId,
          email: requester.email,
          detail: `La solicitud de ${target.firstName} ${target.lastName} fue aprobada.`,
          decision: 'approved',
        });
      }
    }

    return { ok: true };
  }

  private async approveJikkopuntosRequest(
    row: Prisma.ApprovalRequestGetPayload<{
      include: { jikkopuntosDetail: true };
    }>,
    approverUserId: string,
  ) {
    const det = row.jikkopuntosDetail;
    if (!det) {
      throw new BadRequestException('Solicitud de canje sin detalle.');
    }

    await this.ensureAccount(row.targetUserId);
    const balanceBefore = await this.computeLedgerBalance(row.targetUserId);
    if (balanceBefore < det.jpAmount) {
      throw new BadRequestException(
        `Saldo insuficiente en la cuenta del colaborador (${balanceBefore} JP; se requieren ${det.jpAmount} JP).`,
      );
    }

    if (det.redemptionType === REDEMPTION_TYPE.BENEFIT) {
      if (!det.benefitTierId) {
        throw new BadRequestException('Solicitud de beneficio sin catálogo asociado.');
      }
      const tier = await this.prisma.benefitRewardTier.findFirst({
        where: { id: det.benefitTierId, isPublished: true },
      });
      if (!tier) {
        throw new BadRequestException(
          'El beneficio ya no está disponible; rechaza la solicitud.',
        );
      }
    } else if (det.redemptionType === REDEMPTION_TYPE.REST) {
      const kind = det.restKind as RedeemRestKind;
      if (!REDEEM_REST_CONFIG[kind]) {
        throw new BadRequestException('Tipo de descanso inválido en la solicitud.');
      }
    } else {
      throw new BadRequestException('Tipo de canje no soportado.');
    }

    const neg = -det.jpAmount;
    let movementType: string;
    let reason: string;
    let sourceType: string;
    let sourceId: string;

    if (det.redemptionType === REDEMPTION_TYPE.BENEFIT) {
      const tier = await this.prisma.benefitRewardTier.findFirstOrThrow({
        where: { id: det.benefitTierId! },
      });
      movementType = JIKKO_MOVEMENT_TYPE.REDEEM_BENEFIT;
      reason = `Beneficio: ${tier.label}`;
      sourceType = JIKKO_SOURCE_TYPE.BENEFIT_TIER;
      sourceId = tier.id;
    } else {
      const kind = det.restKind as RedeemRestKind;
      const cfg = REDEEM_REST_CONFIG[kind];
      movementType = cfg.movementType;
      reason = `Canje autorizado: ${cfg.label}`;
      sourceType = JIKKO_SOURCE_TYPE.ADMIN;
      sourceId = row.requestedByUserId;
    }

    const justification = row.justification ?? '';
    const attachmentPath = row.attachmentPath ?? undefined;

    const ledgerRow = await this.prisma.$transaction(async (tx) => {
      const txRow = await tx.jikkoPointTransaction.create({
        data: {
          userId: row.targetUserId,
          amount: neg,
          movementType,
          sourceType,
          sourceId,
          reason,
          justification,
          attachmentPath,
        },
      });
      await tx.jikkoPointAccount.update({
        where: { userId: row.targetUserId },
        data: { balance: { increment: neg } },
      });
      await tx.approvalRequest.update({
        where: { id: row.id },
        data: {
          status: APPROVAL_STATUS.APPROVED,
          reviewedByUserId: approverUserId,
          reviewedAt: new Date(),
        },
      });
      await tx.approvalJikkopuntosDetail.update({
        where: { approvalRequestId: row.id },
        data: { ledgerTransactionId: txRow.id },
      });
      return txRow;
    });

    const ledgerAfter = await this.computeLedgerBalance(row.targetUserId);
    await this.reconcileAccountCache(row.targetUserId, ledgerAfter);

    await this.audit.logSecurityEvent({
      userId: row.targetUserId,
      actorUserId: approverUserId,
      action:
        det.redemptionType === REDEMPTION_TYPE.BENEFIT
          ? SECURITY_AUDIT_ACTION.JIKKOPOINTS_BENEFIT_REDEEMED
          : SECURITY_AUDIT_ACTION.JIKKOPOINTS_ADMIN_REDEEM_DEBITED,
      metadata: {
        requestId: row.id,
        ledgerTransactionId: ledgerRow.id,
        jp: det.jpAmount,
        type: det.redemptionType,
      },
    });
    await this.audit.logSecurityEvent({
      userId: row.targetUserId,
      actorUserId: approverUserId,
      action: SECURITY_AUDIT_ACTION.REDEMPTION_APPROVED,
      metadata: { requestId: row.id },
    });

    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.targetUserId },
      select: { email: true, firstName: true, lastName: true },
    });
    const detailMsg =
      det.redemptionType === REDEMPTION_TYPE.BENEFIT
        ? `Tu canje de beneficio por ${det.jpAmount} JP fue aprobado.`
        : `Tu canje de descanso por ${det.jpAmount} JP fue aprobado.`;

    await this.notifications.onApprovalResolved({
      userId: row.targetUserId,
      email: target.email,
      detail: detailMsg,
      decision: 'approved',
      newBalance: ledgerAfter,
    });
    if (row.requestedByUserId !== row.targetUserId) {
      const requester = await this.prisma.user.findUnique({
        where: { id: row.requestedByUserId },
        select: { email: true },
      });
      if (requester) {
        await this.notifications.onApprovalResolved({
          userId: row.requestedByUserId,
          email: requester.email,
          detail: `La solicitud de canje para ${target.firstName} ${target.lastName} fue aprobada.`,
          decision: 'approved',
        });
      }
    }

    return {
      ok: true,
      newBalance: ledgerAfter,
      debitedJp: det.jpAmount,
      ledgerTransactionId: ledgerRow.id,
    };
  }

  async rejectRequest(
    requestId: string,
    approverUserId: string,
    reviewNote?: string,
  ) {
    const row = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });
    if (!row) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (row.status !== APPROVAL_STATUS.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada.');
    }
    if (
      row.requestedByUserId === approverUserId &&
      !this.selfApproveAllowed()
    ) {
      throw new BadRequestException(
        'No puedes rechazar bajo la misma regla de segregación; usa otro administrador.',
      );
    }

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: APPROVAL_STATUS.REJECTED,
        reviewedByUserId: approverUserId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    const auditAction =
      row.category === APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION
        ? SECURITY_AUDIT_ACTION.REDEMPTION_REJECTED
        : SECURITY_AUDIT_ACTION.APPROVAL_REJECTED;

    await this.audit.logSecurityEvent({
      userId: row.targetUserId,
      actorUserId: approverUserId,
      action: auditAction,
      metadata: { requestId, category: row.category, note: reviewNote ?? null },
    });

    const note = reviewNote?.trim();
    const isJp = row.category === APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION;
    const detail = note
      ? `${isJp ? 'Tu solicitud de canje' : 'Tu solicitud'} fue rechazada. Motivo: ${note}`
      : `${isJp ? 'Tu solicitud de canje' : 'Tu solicitud'} fue rechazada.`;

    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: row.targetUserId },
      select: { email: true, firstName: true, lastName: true },
    });
    await this.notifications.onApprovalResolved({
      userId: row.targetUserId,
      email: target.email,
      detail,
      decision: 'rejected',
    });
    if (row.requestedByUserId !== row.targetUserId) {
      const requester = await this.prisma.user.findUnique({
        where: { id: row.requestedByUserId },
        select: { email: true },
      });
      if (requester) {
        await this.notifications.onApprovalResolved({
          userId: row.requestedByUserId,
          email: requester.email,
          detail: `La solicitud para ${target.firstName} ${target.lastName} fue rechazada.${note ? ` ${note}` : ''}`,
          decision: 'rejected',
        });
      }
    }

    return { ok: true };
  }

  async countPendingJikkopuntosForBenefitTier(tierId: string): Promise<number> {
    return this.prisma.approvalRequest.count({
      where: {
        status: APPROVAL_STATUS.PENDING,
        category: APPROVAL_CATEGORY.JIKKOPOINTS_REDEMPTION,
        jikkopuntosDetail: { benefitTierId: tierId },
      },
    });
  }
}
