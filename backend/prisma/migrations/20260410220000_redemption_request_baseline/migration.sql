-- Tabla legada de canjes (alineada a schema previo). IF NOT EXISTS: no rompe bases creadas con `db push`.
CREATE TABLE IF NOT EXISTS "RedemptionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "targetUserId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "benefitTierId" TEXT,
    "restKind" TEXT,
    "jpAmount" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,
    "attachmentPath" TEXT NOT NULL,
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "ledgerTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RedemptionRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RedemptionRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RedemptionRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RedemptionRequest_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "JikkoPointTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RedemptionRequest_status_idx" ON "RedemptionRequest"("status");
CREATE INDEX IF NOT EXISTS "RedemptionRequest_targetUserId_idx" ON "RedemptionRequest"("targetUserId");
CREATE INDEX IF NOT EXISTS "RedemptionRequest_requestedByUserId_idx" ON "RedemptionRequest"("requestedByUserId");
CREATE INDEX IF NOT EXISTS "RedemptionRequest_createdAt_idx" ON "RedemptionRequest"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RedemptionRequest_ledgerTransactionId_key" ON "RedemptionRequest"("ledgerTransactionId");
