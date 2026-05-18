-- Ajuste de datos históricos para eliminar el valor TERRITORIO
UPDATE "Caso"
SET "tipoControl" = 'INGRESO'
WHERE "tipoControl" = 'TERRITORIO';

-- Recreación del enum sin TERRITORIO
CREATE TYPE "TipoControl_new" AS ENUM ('INGRESO', 'EGRESO');

ALTER TABLE "Caso"
ALTER COLUMN "tipoControl" TYPE "TipoControl_new"
USING ("tipoControl"::text::"TipoControl_new");

ALTER TYPE "TipoControl" RENAME TO "TipoControl_old";
ALTER TYPE "TipoControl_new" RENAME TO "TipoControl";
DROP TYPE "TipoControl_old";
