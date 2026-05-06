-- Solicitudes RR.HH. unificadas + detalle por dominio.
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "targetUserId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "justification" TEXT,
    "attachmentPath" TEXT,
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ApprovalJikkopuntosDetail" (
    "approvalRequestId" TEXT NOT NULL PRIMARY KEY,
    "redemptionType" TEXT NOT NULL,
    "benefitTierId" TEXT,
    "restKind" TEXT,
    "jpAmount" INTEGER NOT NULL,
    "ledgerTransactionId" TEXT,
    CONSTRAINT "ApprovalJikkopuntosDetail_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalJikkopuntosDetail_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "JikkoPointTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ApprovalLeaveDetail" (
    "approvalRequestId" TEXT NOT NULL PRIMARY KEY,
    "leaveKind" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "ApprovalLeaveDetail_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApprovalMedicalLeaveDetail" (
    "approvalRequestId" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "clinicalSummary" TEXT,
    CONSTRAINT "ApprovalMedicalLeaveDetail_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ApprovalRequest" (
    "id", "category", "status", "targetUserId", "requestedByUserId",
    "justification", "attachmentPath", "reviewNote", "reviewedByUserId", "reviewedAt",
    "createdAt", "updatedAt"
)
SELECT
    "id",
    'JIKKOPOINTS_REDEMPTION',
    "status",
    "targetUserId",
    "requestedByUserId",
    "justification",
    "attachmentPath",
    "reviewNote",
    "reviewedByUserId",
    "reviewedAt",
    "createdAt",
    "updatedAt"
FROM "RedemptionRequest";

INSERT INTO "ApprovalJikkopuntosDetail" (
    "approvalRequestId", "redemptionType", "benefitTierId", "restKind", "jpAmount", "ledgerTransactionId"
)
SELECT
    "id",
    "type",
    "benefitTierId",
    "restKind",
    "jpAmount",
    "ledgerTransactionId"
FROM "RedemptionRequest";

DROP TABLE "RedemptionRequest";

CREATE INDEX "ApprovalRequest_status_category_idx" ON "ApprovalRequest"("status", "category");
CREATE INDEX "ApprovalRequest_targetUserId_idx" ON "ApprovalRequest"("targetUserId");
CREATE INDEX "ApprovalRequest_requestedByUserId_idx" ON "ApprovalRequest"("requestedByUserId");
CREATE INDEX "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");
CREATE UNIQUE INDEX "ApprovalJikkopuntosDetail_ledgerTransactionId_key" ON "ApprovalJikkopuntosDetail"("ledgerTransactionId");
