ALTER TABLE "Usuario"
ADD COLUMN "esMaster" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Usuario"
SET "esMaster" = true
WHERE "run" = '15960680-5';

CREATE INDEX "Usuario_esMaster_idx" ON "Usuario"("esMaster");

