CREATE TYPE "MotivoCierreSesion" AS ENUM ('LOGOUT', 'INACTIVIDAD', 'EXPIRACION', 'FORZADO');

ALTER TABLE "SesionAcceso"
  ADD COLUMN "ultimaActividadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "motivoCierre" "MotivoCierreSesion";

UPDATE "SesionAcceso"
SET "ultimaActividadAt" = "inicioSesion"
WHERE "ultimaActividadAt" IS NULL;

CREATE INDEX "SesionAcceso_ultimaActividadAt_idx" ON "SesionAcceso"("ultimaActividadAt");
CREATE INDEX "SesionAcceso_cierreSesion_idx" ON "SesionAcceso"("cierreSesion");
