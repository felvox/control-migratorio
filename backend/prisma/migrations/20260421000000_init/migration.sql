CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('ADMINISTRADOR', 'OPERADOR', 'CONSULTA');
CREATE TYPE "TipoControl" AS ENUM ('INGRESO', 'EGRESO', 'TERRITORIO');
CREATE TYPE "TipoPersona" AS ENUM ('PRINCIPAL', 'ACOMPANANTE', 'MENOR');
CREATE TYPE "EstadoCaso" AS ENUM ('PENDIENTE', 'DERIVADO_CARABINEROS', 'DERIVADO_PDI', 'CERRADO');
CREATE TYPE "TipoEvidencia" AS ENUM ('FOTO_PERSONA', 'DOCUMENTO_IDENTIDAD', 'ADJUNTO_GENERAL');
CREATE TYPE "InstitucionDerivacion" AS ENUM ('NINGUNA', 'CARABINEROS', 'PDI');

CREATE TABLE "Usuario" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "nombreUsuario" TEXT NOT NULL,
  "nombreCompleto" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "rol" "Role" NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "eliminadoAt" TIMESTAMP(3),
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Caso" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "codigo" TEXT NOT NULL,
  "tipoControl" "TipoControl" NOT NULL,
  "fechaHoraProcedimiento" TIMESTAMP(3) NOT NULL,
  "lugar" TEXT NOT NULL,
  "coordenadas" TEXT,
  "fechaIngreso" TIMESTAMP(3),
  "documentado" BOOLEAN NOT NULL DEFAULT false,
  "estadoSalud" TEXT,
  "observaciones" TEXT,
  "vieneAcompanado" BOOLEAN NOT NULL DEFAULT false,
  "existenMenores" BOOLEAN NOT NULL DEFAULT false,
  "institucionDerivacion" "InstitucionDerivacion" NOT NULL DEFAULT 'NINGUNA',
  "estado" "EstadoCaso" NOT NULL DEFAULT 'PENDIENTE',
  "creadoPorId" TEXT NOT NULL,
  "actualizadoPorId" TEXT,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoAt" TIMESTAMP(3) NOT NULL,
  "eliminadoAt" TIMESTAMP(3),
  CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Persona" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "casoId" TEXT NOT NULL,
  "tipoPersona" "TipoPersona" NOT NULL,
  "nombres" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "nacionalidad" TEXT NOT NULL,
  "fechaNacimiento" TIMESTAMP(3) NOT NULL,
  "edad" INTEGER NOT NULL,
  "lugarNacimiento" TEXT,
  "numeroDocumento" TEXT NOT NULL,
  "profesionOficio" TEXT,
  "estadoCivil" TEXT,
  "domicilio" TEXT,
  "correo" TEXT,
  "telefono" TEXT,
  "creadoPorId" TEXT,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidencia" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "casoId" TEXT NOT NULL,
  "personaId" TEXT,
  "tipoEvidencia" "TipoEvidencia" NOT NULL,
  "nombreOriginal" TEXT NOT NULL,
  "nombreGuardado" TEXT NOT NULL,
  "rutaArchivo" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "tamanoBytes" INTEGER NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentoGenerado" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "casoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombreOriginal" TEXT NOT NULL,
  "nombreGuardado" TEXT NOT NULL,
  "rutaArchivo" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "tamanoBytes" INTEGER NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoGenerado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Auditoria" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "usuarioId" TEXT,
  "casoId" TEXT,
  "accion" TEXT NOT NULL,
  "entidad" TEXT NOT NULL,
  "entidadId" TEXT,
  "descripcion" TEXT,
  "metadata" JSONB,
  "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SesionAcceso" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "usuarioId" TEXT NOT NULL,
  "inicioSesion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cierreSesion" TIMESTAMP(3),
  "ip" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "SesionAcceso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "Usuario_nombreUsuario_key" ON "Usuario"("nombreUsuario");
CREATE UNIQUE INDEX "Caso_codigo_key" ON "Caso"("codigo");

CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");
CREATE INDEX "Usuario_activo_idx" ON "Usuario"("activo");
CREATE INDEX "Caso_fechaHoraProcedimiento_idx" ON "Caso"("fechaHoraProcedimiento");
CREATE INDEX "Caso_estado_idx" ON "Caso"("estado");
CREATE INDEX "Caso_lugar_idx" ON "Caso"("lugar");
CREATE INDEX "Persona_casoId_idx" ON "Persona"("casoId");
CREATE INDEX "Persona_numeroDocumento_idx" ON "Persona"("numeroDocumento");
CREATE INDEX "Persona_nombres_apellidos_idx" ON "Persona"("nombres", "apellidos");
CREATE INDEX "Evidencia_casoId_idx" ON "Evidencia"("casoId");
CREATE INDEX "Evidencia_personaId_idx" ON "Evidencia"("personaId");
CREATE INDEX "Evidencia_tipoEvidencia_idx" ON "Evidencia"("tipoEvidencia");
CREATE INDEX "DocumentoGenerado_casoId_idx" ON "DocumentoGenerado"("casoId");
CREATE INDEX "DocumentoGenerado_tipo_idx" ON "DocumentoGenerado"("tipo");
CREATE INDEX "Auditoria_fechaHora_idx" ON "Auditoria"("fechaHora");
CREATE INDEX "Auditoria_accion_idx" ON "Auditoria"("accion");
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");
CREATE INDEX "Auditoria_usuarioId_idx" ON "Auditoria"("usuarioId");
CREATE INDEX "SesionAcceso_inicioSesion_idx" ON "SesionAcceso"("inicioSesion");
CREATE INDEX "SesionAcceso_usuarioId_idx" ON "SesionAcceso"("usuarioId");

ALTER TABLE "Caso"
  ADD CONSTRAINT "Caso_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Caso"
  ADD CONSTRAINT "Caso_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Persona"
  ADD CONSTRAINT "Persona_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Persona"
  ADD CONSTRAINT "Persona_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidencia"
  ADD CONSTRAINT "Evidencia_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evidencia"
  ADD CONSTRAINT "Evidencia_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidencia"
  ADD CONSTRAINT "Evidencia_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentoGenerado"
  ADD CONSTRAINT "DocumentoGenerado_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentoGenerado"
  ADD CONSTRAINT "DocumentoGenerado_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auditoria"
  ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Auditoria"
  ADD CONSTRAINT "Auditoria_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SesionAcceso"
  ADD CONSTRAINT "SesionAcceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
