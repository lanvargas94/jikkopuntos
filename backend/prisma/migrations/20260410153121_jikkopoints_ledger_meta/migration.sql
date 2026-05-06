-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JikkoPointTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "movementType" TEXT NOT NULL DEFAULT 'FORM_REWARD',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reason" TEXT NOT NULL,
    "formResponseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JikkoPointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JikkoPointTransaction_formResponseId_fkey" FOREIGN KEY ("formResponseId") REFERENCES "FormResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JikkoPointTransaction" ("amount", "createdAt", "formResponseId", "id", "reason", "userId") SELECT "amount", "createdAt", "formResponseId", "id", "reason", "userId" FROM "JikkoPointTransaction";
DROP TABLE "JikkoPointTransaction";
ALTER TABLE "new_JikkoPointTransaction" RENAME TO "JikkoPointTransaction";
CREATE UNIQUE INDEX "JikkoPointTransaction_formResponseId_key" ON "JikkoPointTransaction"("formResponseId");
CREATE INDEX "JikkoPointTransaction_userId_idx" ON "JikkoPointTransaction"("userId");
CREATE INDEX "JikkoPointTransaction_userId_createdAt_idx" ON "JikkoPointTransaction"("userId", "createdAt");
CREATE INDEX "JikkoPointTransaction_sourceType_sourceId_idx" ON "JikkoPointTransaction"("sourceType", "sourceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
