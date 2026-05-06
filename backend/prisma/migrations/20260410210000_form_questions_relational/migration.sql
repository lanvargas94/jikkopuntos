-- CreateTable
CREATE TABLE "FormQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "settingsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormQuestionOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FormQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FormQuestion_formId_idx" ON "FormQuestion"("formId");

-- CreateIndex
CREATE INDEX "FormQuestion_formId_sortOrder_idx" ON "FormQuestion"("formId", "sortOrder");

-- CreateIndex
CREATE INDEX "FormQuestionOption_questionId_idx" ON "FormQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "FormQuestionOption_questionId_sortOrder_idx" ON "FormQuestionOption"("questionId", "sortOrder");

-- SQLite: hacer schemaJson nullable (recrear tabla si hace falta — Prisma migrate genera según versión)
-- En entornos existentes, ejecutar db push o migración manual según el estado de la BD.
