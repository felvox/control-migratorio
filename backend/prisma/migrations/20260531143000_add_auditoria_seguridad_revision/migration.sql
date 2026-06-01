ALTER TABLE "Auditoria"
  ADD COLUMN "seguridadRevisadoPorId" TEXT,
  ADD COLUMN "seguridadRevisadoAt" TIMESTAMP(3);

CREATE INDEX "Auditoria_seguridadRevisadoAt_idx" ON "Auditoria"("seguridadRevisadoAt");
CREATE INDEX "Auditoria_seguridadRevisadoPorId_idx" ON "Auditoria"("seguridadRevisadoPorId");

ALTER TABLE "Auditoria"
  ADD CONSTRAINT "Auditoria_seguridadRevisadoPorId_fkey"
  FOREIGN KEY ("seguridadRevisadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
