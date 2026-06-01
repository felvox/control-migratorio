CREATE TYPE "FeedbackDireccion" AS ENUM ('A_MASTER', 'A_OPERATIVOS');

ALTER TABLE "Feedback"
  ADD COLUMN "direccion" "FeedbackDireccion" NOT NULL DEFAULT 'A_MASTER',
  ADD COLUMN "jafDestino" "Jaf";

CREATE INDEX "Feedback_direccion_idx" ON "Feedback"("direccion");
CREATE INDEX "Feedback_jafDestino_idx" ON "Feedback"("jafDestino");
