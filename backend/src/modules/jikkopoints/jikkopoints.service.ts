import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import {
  JIKKO_MOVEMENT_TYPE,
  JIKKO_SOURCE_TYPE,
  movementTypeLabel,
} from '../../common/constants/jikkopoint-movement';
import { ROLE_CODES } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';
import {
  REDEEM_REST_CONFIG,
  type RedeemRestKind,
} from './constants/redeem-rest';

const DEFAULT_MOVEMENTS_LIMIT = 50;

@Injectable()
export class JikkoPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  /** Mínimo JP entre beneficios publicados; null si no hay ninguno (sin umbral de catálogo). */
  private async minJpUnlockFromPublished(): Promise<number | null> {
    const rows = await this.prisma.benefitRewardTier.findMany({
      where: { isPublished: true },
      select: { jp: true },
    });
    if (!rows.length) {
      return null;
    }
    return Math.min(...rows.map((r) => r.jp));
  }

  /** Saldo = SUM(amount) del ledger (fuente de verdad). */
  async computeLedgerBalance(userId: string): Promise<number> {
    const agg = await this.prisma.jikkoPointTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /** Alinea cache de cuenta con el ledger si hubo desfase. */
  private async reconcileAccountCache(
    userId: string,
    ledgerBalance: number,
  ): Promise<boolean> {
    const acc = await this.prisma.jikkoPointAccount.findUnique({
      where: { userId },
    });
    if (!acc) {
      return false;
    }
    if (acc.balance === ledgerBalance) {
      return false;
    }
    await this.prisma.jikkoPointAccount.update({
      where: { userId },
      data: { balance: ledgerBalance },
    });
    return true;
  }

  async ensureAccount(userId: string) {
    await this.prisma.jikkoPointAccount.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });
  }

  async getBalanceForUser(userId: string) {
    await this.ensureAccount(userId);
    const ledgerBalance = await this.computeLedgerBalance(userId);
    const repaired = await this.reconcileAccountCache(userId, ledgerBalance);
    const acc = await this.prisma.jikkoPointAccount.findUniqueOrThrow({
      where: { userId },
    });
    return {
      balance: ledgerBalance,
      strategy: 'ledger_sum' as const,
      cachedBalance: acc.balance,
      cacheRepaired: repaired,
      inSync: acc.balance === ledgerBalance,
    };
  }

  async getMovementsForUser(
    userId: string,
    query: { offset?: number; limit?: number },
  ) {
    await this.ensureAccount(userId);
    const limit = Math.min(
      query.limit ?? DEFAULT_MOVEMENTS_LIMIT,
      100,
    );
    const offset = Math.max(0, query.offset ?? 0);
    const [items, total] = await Promise.all([
      this.prisma.jikkoPointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          amount: true,
          movementType: true,
          sourceType: true,
          sourceId: true,
          reason: true,
          justification: true,
          attachmentPath: true,
          formResponseId: true,
          createdAt: true,
        },
      }),
      this.prisma.jikkoPointTransaction.count({ where: { userId } }),
    ]);
    return {
      items: items.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        movementType: row.movementType,
        movementTypeLabel: movementTypeLabel(row.movementType),
        amount: row.amount,
        reason: row.reason,
        justification: row.justification,
        attachmentPath: row.attachmentPath,
        source: {
          type: row.sourceType,
          id: row.sourceId,
          formResponseId: row.formResponseId,
        },
      })),
      total,
      offset,
      limit,
    };
  }

  /**
   * Registra recompensa por formulario dentro de una transacción Prisma existente.
   * Idempotencia: `formResponseId` es único en el ledger → no puede duplicarse el abono por la misma respuesta.
   * Origen del movimiento: `sourceType` FORM_DEFINITION + `sourceId` = id del formulario.
   */
  async applyFormRewardInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      formId: string;
      points: number;
      formTitle: string;
      formResponseId: string;
    },
  ) {
    const points = Math.max(0, Math.floor(params.points));
    if (points <= 0) {
      return;
    }
    await tx.jikkoPointTransaction.create({
      data: {
        userId: params.userId,
        amount: points,
        movementType: JIKKO_MOVEMENT_TYPE.FORM_REWARD,
        sourceType: JIKKO_SOURCE_TYPE.FORM_DEFINITION,
        sourceId: params.formId,
        reason: `Formulario: ${params.formTitle}`,
        formResponseId: params.formResponseId,
      },
    });
    await tx.jikkoPointAccount.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId, balance: points },
      update: { balance: { increment: points } },
    });
  }

  /** Resumen para compatibilidad (un solo round-trip). */
  async getMySummary(userId: string) {
    const balancePayload = await this.getBalanceForUser(userId);
    const movements = await this.getMovementsForUser(userId, {
      limit: DEFAULT_MOVEMENTS_LIMIT,
      offset: 0,
    });
    return {
      ...balancePayload,
      movements: movements.items,
      movementsTotal: movements.total,
      recentTransactions: movements.items,
    };
  }

  private async collaboratorRoleId(): Promise<string> {
    const role = await this.prisma.role.findUnique({
      where: { code: ROLE_CODES.COLLABORATOR },
    });
    if (!role) {
      throw new NotFoundException('Rol COLABORATOR no configurado');
    }
    return role.id;
  }

  /**
   * Colaboradores con saldo neto (suma del ledger) y datos de perfil.
   * Orden: saldo desc, luego correo.
   */
  private async listCollaboratorsWithBalances() {
    const roleId = await this.collaboratorRoleId();
    const users = await this.prisma.user.findMany({
      where: { roleId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        idNumber: true,
        isActive: true,
        profile: {
          select: { jobTitle: true, area: true },
        },
      },
      orderBy: { email: 'asc' },
    });
    if (users.length === 0) {
      return [];
    }
    const ids = users.map((u) => u.id);
    const sums = await this.prisma.jikkoPointTransaction.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _sum: { amount: true },
    });
    const sumMap = new Map(
      sums.map((s) => [s.userId, s._sum.amount ?? 0]),
    );
    const rows = users.map((u) => ({
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      idNumber: u.idNumber,
      isActive: u.isActive,
      jobTitle: u.profile?.jobTitle ?? null,
      area: u.profile?.area ?? null,
      balance: sumMap.get(u.id) ?? 0,
    }));
    rows.sort((a, b) => {
      if (b.balance !== a.balance) {
        return b.balance - a.balance;
      }
      return a.email.localeCompare(b.email, 'es');
    });
    return rows;
  }

  /** Top colaboradores por saldo neto (solo rol colaborador activo). */
  async getAdminLeaderboard(limit: number) {
    const take = Math.min(50, Math.max(1, limit));
    const rows = await this.listCollaboratorsWithBalances();
    const items = rows.slice(0, take).map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      jobTitle: r.jobTitle,
      area: r.area,
      balance: r.balance,
    }));
    return {
      generatedAt: new Date().toISOString(),
      limit: take,
      totalCollaborators: rows.length,
      items,
    };
  }

  /** Excel: todos los colaboradores activos con saldo neto a la fecha. */
  async buildAdminExcelReport(): Promise<Buffer> {
    const rows = await this.listCollaboratorsWithBalances();
    const wb = new Workbook();
    wb.creator = 'Jikkosoft';
    wb.created = new Date();
    const ws = wb.addWorksheet('Jikkopuntos', {
      properties: { defaultRowHeight: 18 },
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    ws.mergeCells('A1:H1');
    const title = ws.getCell('A1');
    title.value = `Reporte de jikkopuntos — ${new Date().toLocaleString('es-CO')}`;
    title.font = { bold: true, size: 12 };
    ws.getRow(2).values = [
      'Correo',
      'Nombres',
      'Apellidos',
      'Documento',
      'Activo',
      'Cargo',
      'Área',
      'Saldo neto (JP)',
    ];
    ws.getRow(2).font = { bold: true };
    ws.columns = [
      { width: 32 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 10 },
      { width: 28 },
      { width: 20 },
      { width: 16 },
    ];
    let r = 3;
    for (const row of rows) {
      ws.getRow(r).values = [
        row.email,
        row.firstName,
        row.lastName,
        row.idNumber,
        row.isActive ? 'Sí' : 'No',
        row.jobTitle ?? '',
        row.area ?? '',
        row.balance,
      ];
      r += 1;
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  getAdminRedeemRestOptions() {
    return (Object.keys(REDEEM_REST_CONFIG) as RedeemRestKind[]).map((kind) => {
      const c = REDEEM_REST_CONFIG[kind];
      return { kind, label: c.label, jp: c.jp };
    });
  }

  async findCollaboratorByIdNumberForAdmin(idNumberRaw: string) {
    const idNumber = idNumberRaw.trim();
    if (!idNumber) {
      throw new BadRequestException('Indica un número de documento.');
    }
    const roleId = await this.collaboratorRoleId();
    const user = await this.prisma.user.findFirst({
      where: { idNumber, roleId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        idNumber: true,
        isActive: true,
      },
    });
    if (!user) {
      throw new NotFoundException(
        'No se encontró un colaborador con ese documento.',
      );
    }
    await this.ensureAccount(user.id);
    const balance = await this.computeLedgerBalance(user.id);
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      idNumber: user.idNumber,
      isActive: user.isActive,
      balance,
    };
  }

  async getCollaboratorMovementsForAdmin(
    idNumberRaw: string,
    query: { offset?: number; limit?: number },
  ) {
    const collab = await this.findCollaboratorByIdNumberForAdmin(idNumberRaw);
    const movements = await this.getMovementsForUser(collab.userId, query);
    return {
      collaborator: {
        userId: collab.userId,
        firstName: collab.firstName,
        lastName: collab.lastName,
        idNumber: collab.idNumber,
        isActive: collab.isActive,
        balance: collab.balance,
      },
      items: movements.items,
      total: movements.total,
      offset: movements.offset,
      limit: movements.limit,
    };
  }

  async adminRedeemRest(params: {
    adminUserId: string;
    targetUserId: string;
    kind: RedeemRestKind;
    justification: string;
    attachmentRelativePath: string;
  }) {
    const cfg = REDEEM_REST_CONFIG[params.kind];
    if (!cfg) {
      throw new BadRequestException('Tipo de canje no válido.');
    }
    const roleId = await this.collaboratorRoleId();
    const target = await this.prisma.user.findFirst({
      where: { id: params.targetUserId, roleId },
    });
    if (!target) {
      throw new NotFoundException('Colaborador no encontrado.');
    }
    if (!target.isActive) {
      throw new BadRequestException(
        'El colaborador está inactivo; no se puede registrar el canje.',
      );
    }
    await this.ensureAccount(target.id);
    const balanceBefore = await this.computeLedgerBalance(target.id);
    const minUnlock = await this.minJpUnlockFromPublished();
    if (minUnlock !== null && balanceBefore < minUnlock) {
      throw new BadRequestException(
        `El colaborador no alcanza el mínimo de ${minUnlock} JP para canjes alineados a beneficios.`,
      );
    }
    if (balanceBefore < cfg.jp) {
      throw new BadRequestException(
        `Saldo insuficiente: el colaborador tiene ${balanceBefore} JP y el canje cuesta ${cfg.jp} JP.`,
      );
    }

    const request = await this.approvals.createJikkopuntosRestPending({
      targetUserId: target.id,
      requestedByUserId: params.adminUserId,
      kind: params.kind,
      jp: cfg.jp,
      justification: params.justification.trim(),
      attachmentPath: params.attachmentRelativePath,
    });

    return {
      requestId: request.id,
      status: 'PENDING',
      targetUserId: target.id,
      jp: cfg.jp,
      movementType: cfg.movementType,
    };
  }

  async getBenefitRewardTiers() {
    const published = await this.prisma.benefitRewardTier.findMany({
      where: { isPublished: true },
      orderBy: [{ jp: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, jp: true, label: true },
    });
    const minJpToUnlock =
      published.length > 0 ? Math.min(...published.map((t) => t.jp)) : 0;
    return {
      minJpToUnlock,
      tiers: published.map((t) => ({ id: t.id, jp: t.jp, label: t.label })),
    };
  }

  async listBenefitTiersForAdmin() {
    return this.prisma.benefitRewardTier.findMany({
      orderBy: [{ jp: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createBenefitTier(params: {
    label: string;
    jp: number;
    isPublished: boolean;
  }) {
    const maxOrder = await this.prisma.benefitRewardTier.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    return this.prisma.benefitRewardTier.create({
      data: {
        label: params.label.trim(),
        jp: params.jp,
        isPublished: params.isPublished,
        sortOrder,
      },
    });
  }

  async updateBenefitTier(
    id: string,
    patch: { label?: string; jp?: number; isPublished?: boolean },
  ) {
    const existing = await this.prisma.benefitRewardTier.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficio no encontrado.');
    }
    const data: Prisma.BenefitRewardTierUpdateInput = {};
    if (patch.label !== undefined) {
      data.label = patch.label.trim();
    }
    if (patch.jp !== undefined) {
      data.jp = patch.jp;
    }
    if (patch.isPublished !== undefined) {
      data.isPublished = patch.isPublished;
    }
    if (Object.keys(data).length === 0) {
      return existing;
    }
    return this.prisma.benefitRewardTier.update({
      where: { id },
      data,
    });
  }

  async deleteBenefitTier(id: string) {
    const existing = await this.prisma.benefitRewardTier.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficio no encontrado.');
    }
    const redemptions = await this.prisma.jikkoPointTransaction.count({
      where: {
        sourceType: JIKKO_SOURCE_TYPE.BENEFIT_TIER,
        sourceId: id,
      },
    });
    if (redemptions > 0) {
      throw new BadRequestException(
        'No se puede eliminar: existen canjes registrados con este beneficio.',
      );
    }
    const pendingReq = await this.approvals.countPendingJikkopuntosForBenefitTier(id);
    if (pendingReq > 0) {
      throw new BadRequestException(
        'No se puede eliminar: hay solicitudes de canje pendientes con este beneficio.',
      );
    }
    await this.prisma.benefitRewardTier.delete({ where: { id } });
  }

  async redeemCollaboratorBenefit(params: {
    userId: string;
    roleCode: string;
    tierId: string;
    justification: string;
    attachmentRelativePath: string;
  }) {
    if (params.roleCode !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException(
        'Solo los colaboradores pueden canjear beneficios desde esta vía.',
      );
    }
    const tier = await this.prisma.benefitRewardTier.findFirst({
      where: { id: params.tierId, isPublished: true },
    });
    if (!tier) {
      throw new BadRequestException('Recompensa no válida o no disponible.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      include: { role: true },
    });
    if (!user || user.role.code !== ROLE_CODES.COLLABORATOR) {
      throw new ForbiddenException('Operación no permitida.');
    }
    if (!user.isActive) {
      throw new BadRequestException('Tu cuenta está inactiva; no puedes canjear.');
    }
    await this.ensureAccount(user.id);
    const balanceBefore = await this.computeLedgerBalance(user.id);
    const minUnlock = await this.minJpUnlockFromPublished();
    if (minUnlock !== null && balanceBefore < minUnlock) {
      throw new BadRequestException(
        `Aún no alcanzas el mínimo de ${minUnlock} JP para canjear beneficios.`,
      );
    }
    if (balanceBefore < tier.jp) {
      throw new BadRequestException(
        `Saldo insuficiente para esta recompensa: tienes ${balanceBefore} JP y se requieren ${tier.jp} JP.`,
      );
    }

    const request = await this.approvals.createJikkopuntosBenefitPending({
      targetUserId: user.id,
      requestedByUserId: user.id,
      tierId: tier.id,
      jp: tier.jp,
      justification: params.justification.trim(),
      attachmentPath: params.attachmentRelativePath,
    });

    return {
      requestId: request.id,
      status: 'PENDING',
      tierId: tier.id,
      jp: tier.jp,
    };
  }
}
