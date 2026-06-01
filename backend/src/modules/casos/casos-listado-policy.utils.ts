import { ForbiddenException } from '@nestjs/common';
import { EstadoCaso, InstitucionDerivacion, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { QueryCasosDto } from './dto/query-casos.dto';

export function resolverFiltroDerivacionPorRol(
  user: AuthUser,
  query: QueryCasosDto,
): Prisma.CasoWhereInput {
  if (user.role === Role.CARABINEROS) {
    return resolverFiltroCarabineros(query);
  }

  if (user.role === Role.PDI) {
    return resolverFiltroPdi(query);
  }

  return {};
}

function resolverFiltroCarabineros(query: QueryCasosDto): Prisma.CasoWhereInput {
  const institucion = query.institucionDerivacion;

  if (institucion === InstitucionDerivacion.PDI) {
    if (
      query.estado &&
      !([EstadoCaso.DERIVADO_PDI, EstadoCaso.CERRADO] as EstadoCaso[]).includes(query.estado)
    ) {
      throw new ForbiddenException(
        'Filtro de estado no permitido para seguimiento PDI de Carabineros',
      );
    }

    return {
      institucionDerivacion: InstitucionDerivacion.PDI,
      existenMenores: true,
      estado: query.estado ?? {
        in: [EstadoCaso.DERIVADO_PDI, EstadoCaso.CERRADO],
      },
    };
  }

  if (institucion === InstitucionDerivacion.CARABINEROS) {
    if (query.estado && query.estado !== EstadoCaso.DERIVADO_CARABINEROS) {
      throw new ForbiddenException('Filtro de estado no permitido para casos de Carabineros');
    }

    return {
      institucionDerivacion: InstitucionDerivacion.CARABINEROS,
      estado: query.estado ?? EstadoCaso.DERIVADO_CARABINEROS,
    };
  }

  if (!institucion) {
    if (query.estado === EstadoCaso.DERIVADO_CARABINEROS) {
      return {
        institucionDerivacion: InstitucionDerivacion.CARABINEROS,
        estado: EstadoCaso.DERIVADO_CARABINEROS,
      };
    }

    if (query.estado === EstadoCaso.DERIVADO_PDI) {
      return {
        institucionDerivacion: InstitucionDerivacion.PDI,
        existenMenores: true,
        estado: EstadoCaso.DERIVADO_PDI,
      };
    }

    if (query.estado && query.estado !== EstadoCaso.CERRADO) {
      return { id: '__sin_resultados__' };
    }

    return {
      institucionDerivacion: InstitucionDerivacion.PDI,
      existenMenores: true,
      estado: EstadoCaso.CERRADO,
    };
  }

  throw new ForbiddenException('Filtro de institución no permitido para el perfil Carabineros');
}

function resolverFiltroPdi(query: QueryCasosDto): Prisma.CasoWhereInput {
  const institucion = query.institucionDerivacion;

  if (institucion && institucion !== InstitucionDerivacion.PDI) {
    throw new ForbiddenException('Filtro de institución no permitido para el perfil PDI');
  }

  if (institucion === InstitucionDerivacion.PDI) {
    if (
      query.estado &&
      !([EstadoCaso.DERIVADO_PDI, EstadoCaso.CERRADO] as EstadoCaso[]).includes(query.estado)
    ) {
      throw new ForbiddenException('Filtro de estado no permitido para el perfil PDI');
    }

    return {
      institucionDerivacion: InstitucionDerivacion.PDI,
      estado: query.estado ?? EstadoCaso.DERIVADO_PDI,
    };
  }

  if (query.estado && query.estado !== EstadoCaso.CERRADO) {
    return { id: '__sin_resultados__' };
  }

  return {
    institucionDerivacion: InstitucionDerivacion.PDI,
    estado: EstadoCaso.CERRADO,
  };
}
