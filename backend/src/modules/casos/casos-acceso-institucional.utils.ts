import { ForbiddenException } from '@nestjs/common';
import { InstitucionDerivacion, Jaf, Role } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

export interface CasoInstitucionalAcceso {
  creadoPorId: string;
  jaf: Jaf;
  institucionDerivacion?: InstitucionDerivacion | null;
  existenMenores?: boolean;
}

interface MensajesAcceso {
  noPermisoPropio: string;
  noPermisoJaf: string;
  noPermisoCarabineros: string;
  noPermisoPdi: string;
}

interface OpcionesAccesoInstitucional {
  restringirOperadorACreador?: boolean;
}

const ROLES_RESTRICCION_JAF = new Set<Role>([
  Role.CONSULTA,
  Role.CARABINEROS,
  Role.PDI,
]);

export function tieneRestriccionJafInstitucional(user: AuthUser): boolean {
  return ROLES_RESTRICCION_JAF.has(user.role) || (user.role === Role.ADMINISTRADOR && !user.esMaster);
}

export function validarAccesoInstitucionalCaso(
  caso: CasoInstitucionalAcceso,
  user: AuthUser,
  mensajes: MensajesAcceso,
  opciones?: OpcionesAccesoInstitucional,
): void {
  if (
    opciones?.restringirOperadorACreador &&
    user.role === Role.OPERADOR &&
    caso.creadoPorId !== user.id
  ) {
    throw new ForbiddenException(mensajes.noPermisoPropio);
  }

  if (tieneRestriccionJafInstitucional(user) && (!user.jaf || caso.jaf !== user.jaf)) {
    throw new ForbiddenException(mensajes.noPermisoJaf);
  }

  if (user.role === Role.CARABINEROS) {
    const accesoCarabineros =
      caso.institucionDerivacion === InstitucionDerivacion.CARABINEROS ||
      (caso.institucionDerivacion === InstitucionDerivacion.PDI &&
        caso.existenMenores === true);

    if (!accesoCarabineros) {
      throw new ForbiddenException(mensajes.noPermisoCarabineros);
    }
  }

  if (user.role === Role.PDI && caso.institucionDerivacion !== InstitucionDerivacion.PDI) {
    throw new ForbiddenException(mensajes.noPermisoPdi);
  }
}
