ALTER TABLE "Usuario"
  ADD COLUMN "run" TEXT;

UPDATE "Usuario"
SET "run" = UPPER(REGEXP_REPLACE(COALESCE("nombreUsuario", ''), '\\.', '', 'g'))
WHERE "run" IS NULL;

UPDATE "Usuario"
SET "run" = '11111111-1'
WHERE "email" = 'admin@controlmigratorio.local';

UPDATE "Usuario"
SET "run" = '22222222-2'
WHERE "email" = 'operador@controlmigratorio.local';

UPDATE "Usuario"
SET "run" = '33333333-3'
WHERE "email" = 'consulta@controlmigratorio.local';

UPDATE "Usuario"
SET "run" = CONCAT(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 8), '-K')
WHERE "run" IS NULL OR "run" = '';

ALTER TABLE "Usuario"
  ALTER COLUMN "run" SET NOT NULL;

CREATE UNIQUE INDEX "Usuario_run_key" ON "Usuario"("run");

DROP INDEX IF EXISTS "Usuario_nombreUsuario_key";

ALTER TABLE "Usuario"
  DROP COLUMN IF EXISTS "nombreUsuario";

ALTER TABLE "Usuario"
  ALTER COLUMN "email" DROP NOT NULL;
