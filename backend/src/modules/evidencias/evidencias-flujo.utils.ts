import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { EstadoCaso, InstitucionDerivacion, Role, TipoEvidencia } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UploadEvidenciaDto } from './dto/upload-evidencia.dto';

export function validarEtapaCargaInstitucional(
  caso: {
    estado: EstadoCaso;
    institucionDerivacion?: InstitucionDerivacion | null;
  },
  dto: UploadEvidenciaDto,
  user: AuthUser,
): void {
  if (user.role !== Role.CARABINEROS && user.role !== Role.PDI) {
    return;
  }

  if (dto.tipoEvidencia !== TipoEvidencia.ADJUNTO_GENERAL) {
    throw new ForbiddenException(
      'Solo puede cargar documentación institucional como adjunto general',
    );
  }

  if (
    user.role === Role.CARABINEROS &&
    (caso.estado !== EstadoCaso.DERIVADO_CARABINEROS ||
      caso.institucionDerivacion !== InstitucionDerivacion.CARABINEROS)
  ) {
    throw new ForbiddenException(
      'La gestión de Carabineros está cerrada. El caso ya fue enviado a PDI.',
    );
  }

  if (
    user.role === Role.PDI &&
    (caso.estado !== EstadoCaso.DERIVADO_PDI ||
      caso.institucionDerivacion !== InstitucionDerivacion.PDI)
  ) {
    throw new ForbiddenException(
      'La gestión de PDI solo está disponible para casos derivados a PDI.',
    );
  }
}

export function validarPersonaRequerida(dto: UploadEvidenciaDto): void {
  const requierePersona =
    dto.tipoEvidencia === TipoEvidencia.FOTO_PERSONA ||
    dto.tipoEvidencia === TipoEvidencia.DOCUMENTO_IDENTIDAD;

  if (requierePersona && !dto.personaId) {
    throw new BadRequestException(
      'personaId es obligatorio para este tipo de evidencia',
    );
  }
}

export function validarEliminacionInstitucional(
  tipoEvidencia: TipoEvidencia,
  rol: Role,
): void {
  if (
    (rol === Role.CARABINEROS || rol === Role.PDI) &&
    tipoEvidencia !== TipoEvidencia.ADJUNTO_GENERAL
  ) {
    throw new ForbiddenException(
      'Solo puede eliminar documentación institucional cargada como adjunto general',
    );
  }
}
