import { BadRequestException } from '@nestjs/common';
import { EstadoCaso, InstitucionDerivacion, Role } from '@prisma/client';
import { CerrarPdiDto, PdiResultado, PdiSituacionMigratoria } from './dto/cerrar-pdi.dto';

export function resolverFlujo(existenMenores: boolean): {
  estado: EstadoCaso;
  institucionDerivacion: InstitucionDerivacion;
} {
  return {
    estado: EstadoCaso.PENDIENTE,
    institucionDerivacion: existenMenores
      ? InstitucionDerivacion.CARABINEROS
      : InstitucionDerivacion.PDI,
  };
}

export function etiquetaObservacionPorRol(role: Role): string {
  if (role === Role.CARABINEROS) {
    return 'CARABINEROS';
  }

  if (role === Role.PDI) {
    return 'PDI';
  }

  return 'ADMINISTRADOR';
}

export function construirLineaObservacionInstitucional(
  role: Role,
  observacion: string,
  fechaIso: string,
): string {
  const marca = etiquetaObservacionPorRol(role);
  return `[OBS_${marca} ${fechaIso}] ${observacion}`;
}

export function agregarLineaObservacion(
  observacionesActuales: string | null | undefined,
  linea: string,
): string {
  const base = (observacionesActuales ?? '').trim();
  return base ? `${base}\n${linea}` : linea;
}

export function resolverResultadoPdi(dto: CerrarPdiDto): PdiResultado {
  if (dto.ordenJudicialVigente) {
    return 'PUESTA_DISPOSICION_TRIBUNAL';
  }

  if (!dto.situacionMigratoria) {
    throw new BadRequestException(
      'Debe indicar la situación migratoria para cerrar el caso en PDI.',
    );
  }

  if (dto.situacionMigratoria === 'EGRESO_PNH') {
    return 'DENUNCIA_SNM_SALIDA_VOLUNTARIA';
  }

  if (typeof dto.reconducible !== 'boolean') {
    throw new BadRequestException(
      'Debe indicar si la persona es reconducible para ingresos por paso no habilitado.',
    );
  }

  return dto.reconducible ? 'RECONDUCCION' : 'DENUNCIA_SNM_TERRITORIO_NACIONAL';
}

export function construirLineaResolucionPdi(dto: CerrarPdiDto, resultado: PdiResultado): string {
  const partes = [
    'Resolución PDI registrada.',
    `Orden judicial vigente: ${dto.ordenJudicialVigente ? 'Sí' : 'No'}.`,
    `Situación migratoria: ${etiquetaSituacionMigratoriaPdi(dto.situacionMigratoria)}.`,
  ];

  if (!dto.ordenJudicialVigente && dto.situacionMigratoria === 'INGRESO_PNH') {
    partes.push(`Reconducible: ${dto.reconducible ? 'Sí' : 'No'}.`);
  }

  partes.push(`Resultado: ${etiquetaResultadoPdi(resultado)}.`);

  const observaciones = dto.observaciones?.trim();
  if (observaciones) {
    partes.push(`Observaciones: ${observaciones}`);
  }

  return partes.join(' ');
}

function etiquetaSituacionMigratoriaPdi(situacion?: PdiSituacionMigratoria): string {
  if (situacion === 'INGRESO_PNH') {
    return 'Ingreso por paso no habilitado';
  }

  if (situacion === 'EGRESO_PNH') {
    return 'Egreso por paso no habilitado';
  }

  return 'No aplica';
}

function etiquetaResultadoPdi(resultado: PdiResultado): string {
  if (resultado === 'RECONDUCCION') {
    return 'Reconducción';
  }

  if (resultado === 'DENUNCIA_SNM_TERRITORIO_NACIONAL') {
    return 'Denuncia al Servicio Nacional de Migraciones y permanencia en territorio nacional';
  }

  if (resultado === 'DENUNCIA_SNM_SALIDA_VOLUNTARIA') {
    return 'Denuncia al Servicio Nacional de Migraciones y salida voluntaria';
  }

  return 'Puesta a disposición del tribunal';
}
