-- Creación de catálogo JAF
CREATE TYPE "Jaf" AS ENUM ('TARAPACA', 'ANTOFAGASTA', 'ARICA_PARINACOTA');

-- Usuario: JAF opcional (obligatoria para operadores/consulta por regla de negocio)
ALTER TABLE "Usuario"
ADD COLUMN "jaf" "Jaf";

-- Caso: JAF obligatoria
ALTER TABLE "Caso"
ADD COLUMN "jaf" "Jaf";

-- Backfill de casos históricos usando la JAF del creador cuando exista
UPDATE "Caso" c
SET "jaf" = COALESCE(u."jaf", 'TARAPACA'::"Jaf")
FROM "Usuario" u
WHERE c."creadoPorId" = u."id";

-- Fallback para cualquier caso restante
UPDATE "Caso"
SET "jaf" = 'TARAPACA'::"Jaf"
WHERE "jaf" IS NULL;

ALTER TABLE "Caso"
ALTER COLUMN "jaf" SET NOT NULL,
ALTER COLUMN "jaf" SET DEFAULT 'TARAPACA';

CREATE INDEX "Usuario_jaf_idx" ON "Usuario"("jaf");
CREATE INDEX "Caso_jaf_idx" ON "Caso"("jaf");
