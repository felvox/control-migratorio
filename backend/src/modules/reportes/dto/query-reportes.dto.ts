import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EstadoCaso, InstitucionDerivacion, Jaf, Role } from '@prisma/client';
import {
  TIPOS_CONTROL_PERMITIDOS,
  TipoControlPermitido,
} from '../../../common/constants/tipo-control.const';

function parseBoolean(
  value: unknown,
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

export class QueryReportesDto {
  @IsOptional()
  @IsString()
  tipo?:
    | 'casos-creados'
    | 'casos-carabineros'
    | 'casos-pdi'
    | 'casos-cerrados'
    | 'casos-operativos'
    | 'tiempos-sla';

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsDateString()
  fechaCierreDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaCierreHasta?: string;

  @IsOptional()
  @IsEnum(Jaf)
  jaf?: Jaf;

  @IsOptional()
  @IsEnum(EstadoCaso)
  estado?: EstadoCaso;

  @IsOptional()
  @IsEnum(InstitucionDerivacion)
  institucion?: InstitucionDerivacion;

  @IsOptional()
  @IsIn(TIPOS_CONTROL_PERMITIDOS)
  tipoControl?: TipoControlPermitido;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  conMenores?: boolean;

  @IsOptional()
  @IsString()
  resultadoPdi?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @IsEnum(Role)
  rol?: Role;

  @IsOptional()
  @IsString()
  accion?: string;

  @IsOptional()
  @IsString()
  tipoEvento?: string;

  @IsOptional()
  @IsIn(['PENDIENTES', 'REVISADOS', 'TODOS'])
  estadoRevision?: 'PENDIENTES' | 'REVISADOS' | 'TODOS';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  slaHoras?: number;
}
