import { ForbiddenException } from '@nestjs/common';
import { EstadoCaso, InstitucionDerivacion, Jaf, Role } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

export const ROLES_CON_RESTRICCION_JAF = new Set<Role>([
  Role.OPERADOR,
  Role.CONSULTA,
  Role.CARABINEROS,
  Role.PDI,
]);

export interface CasoAccesoContext {
  creadoPorId?: string;
  jaf: Jaf;
  estado?: EstadoCaso;
  institucionDerivacion?: InstitucionDerivacion | null;
  existenMenores?: boolean;
}

export interface CasoGestionInstitucionalContext {
  estado: EstadoCaso;
  institucionDerivacion?: InstitucionDerivacion | null;
}

export function tieneRestriccionPorJaf(user: AuthUser): boolean {
  return ROLES_CON_RESTRICCION_JAF.has(user.role) || (user.role === Role.ADMINISTRADOR && !user.esMaster);
}

export function resolverJafParaCreacion(dtoJaf: Jaf | undefined, user: AuthUser): Jaf {
  if (tieneRestriccionPorJaf(user)) {
    if (!user.jaf) {
      throw new ForbiddenException('Usuario sin JAF asignada. Contacte a un administrador.');
    }

    return user.jaf;
  }

  if (dtoJaf) {
    return dtoJaf;
  }

  if (user.jaf) {
    return user.jaf;
  }

  return Jaf.TARAPACA;
}

export function resolverJafParaActualizacion(
  dtoJaf: Jaf | undefined,
  user: AuthUser,
  jafActual: Jaf,
): Jaf {
  if (tieneRestriccionPorJaf(user)) {
    if (!user.jaf) {
      throw new ForbiddenException('Usuario sin JAF asignada. Contacte a un administrador.');
    }

    return user.jaf;
  }

  return dtoJaf ?? jafActual;
}

export function validarAccesoCaso(caso: CasoAccesoContext, user: AuthUser): void {
  if (tieneRestriccionPorJaf(user)) {
    if (!user.jaf || caso.jaf !== user.jaf) {
      throw new ForbiddenException('No tiene permisos para acceder a casos de otra JAF');
    }
  }

  if (user.role === Role.CARABINEROS) {
    const accesoCarabineros =
      (caso.institucionDerivacion === InstitucionDerivacion.CARABINEROS &&
        caso.estado === EstadoCaso.DERIVADO_CARABINEROS) ||
      (caso.institucionDerivacion === InstitucionDerivacion.PDI &&
        caso.estado !== EstadoCaso.PENDIENTE &&
        caso.existenMenores === true);

    if (!accesoCarabineros) {
      throw new ForbiddenException(
        'Solo puede consultar casos de Carabineros o seguimiento de menores derivados a PDI',
      );
    }
  }

  if (
    user.role === Role.PDI &&
    (caso.institucionDerivacion !== InstitucionDerivacion.PDI || caso.estado === EstadoCaso.PENDIENTE)
  ) {
    throw new ForbiddenException('Solo puede consultar casos derivados a PDI');
  }
}

export function validarGestionMasterSobreCaso(
  caso: Pick<CasoAccesoContext, 'creadoPorId' | 'jaf'>,
  user: AuthUser,
): void {
  if (user.role !== Role.ADMINISTRADOR || !user.esMaster) {
    return;
  }

  const creadoPorMaster = caso.creadoPorId === user.id;
  const mismaJaf = Boolean(user.jaf && caso.jaf === user.jaf);

  if (!creadoPorMaster && !mismaJaf) {
    throw new ForbiddenException(
      'Administrador Master con consulta nacional. Solo puede gestionar casos de su JAF o casos creados por su cuenta.',
    );
  }
}

export function validarGestionSoloCreador(
  caso: Pick<CasoAccesoContext, 'creadoPorId'>,
  user: AuthUser,
  accion: string,
): void {
  if (caso.creadoPorId !== user.id) {
    throw new ForbiddenException(
      `Solo el usuario que creó el caso puede ${accion}.`,
    );
  }
}

export function validarRolFlujo(user: AuthUser, allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new ForbiddenException('No tiene permisos para ejecutar esta acción');
  }
}

export function validarEtapaGestionInstitucional(
  caso: CasoGestionInstitucionalContext,
  user: AuthUser,
): void {
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
    throw new ForbiddenException('La gestión de PDI solo está disponible para casos derivados a PDI.');
  }

  if (
    user.role === Role.ADMINISTRADOR &&
    caso.estado !== EstadoCaso.DERIVADO_CARABINEROS &&
    caso.estado !== EstadoCaso.DERIVADO_PDI
  ) {
    throw new ForbiddenException(
      'La etapa institucional actual no permite agregar nuevas constancias.',
    );
  }
}
