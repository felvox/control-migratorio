-- Garantiza que exista como máximo un usuario master en el sistema.
-- Si por datos históricos hubiera más de uno, conserva el más reciente.
UPDATE "Usuario" u
SET "esMaster" = false
WHERE u."esMaster" = true
  AND u."id" NOT IN (
    SELECT id
    FROM "Usuario"
    WHERE "esMaster" = true
    ORDER BY "actualizadoAt" DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_single_master_unique"
ON "Usuario" ("esMaster")
WHERE "esMaster" = true;
