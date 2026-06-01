CREATE TYPE "FeedbackPrioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');
CREATE TYPE "FeedbackEstado" AS ENUM ('PENDIENTE', 'REVISADO');

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asunto" TEXT NOT NULL,
  "mensaje" TEXT NOT NULL,
  "prioridad" "FeedbackPrioridad" NOT NULL DEFAULT 'MEDIA',
  "estado" "FeedbackEstado" NOT NULL DEFAULT 'PENDIENTE',
  "jaf" "Jaf" NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "revisadoPorId" TEXT,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisadoAt" TIMESTAMP(3),
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_estado_idx" ON "Feedback"("estado");
CREATE INDEX "Feedback_jaf_idx" ON "Feedback"("jaf");
CREATE INDEX "Feedback_creadoAt_idx" ON "Feedback"("creadoAt");
CREATE INDEX "Feedback_usuarioId_idx" ON "Feedback"("usuarioId");

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
