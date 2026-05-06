-- Backfill referencia de origen en movimientos existentes
UPDATE "JikkoPointTransaction"
SET "sourceType" = 'FORM_RESPONSE', "sourceId" = "formResponseId"
WHERE "formResponseId" IS NOT NULL;
