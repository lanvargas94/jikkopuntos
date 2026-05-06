import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditRequestContext } from '../../common/http/request-audit.util';
import { PrismaService } from '../../prisma/prisma.service';

export type SecurityAuditInput = {
  userId: string;
  actorUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
  context?: AuditRequestContext;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private truncateUa(ua?: string | null): string | undefined {
    if (!ua) return undefined;
    return ua.length > 400 ? ua.slice(0, 400) : ua;
  }

  private toCreateData(input: SecurityAuditInput): Prisma.SecurityAuditLogUncheckedCreateInput {
    return {
      userId: input.userId,
      actorUserId: input.actorUserId,
      action: input.action,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      ipAddress: input.context?.ip ?? undefined,
      userAgent: this.truncateUa(input.context?.userAgent),
    };
  }

  async logSecurityEvent(input: SecurityAuditInput) {
    await this.prisma.securityAuditLog.create({
      data: this.toCreateData(input),
    });
  }

  logSecurityEventTx(
    tx: Prisma.TransactionClient,
    input: SecurityAuditInput,
  ) {
    return tx.securityAuditLog.create({
      data: this.toCreateData(input),
    });
  }
}
