import { EstadoCaso, InstitucionDerivacion, Jaf } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  TIPOS_CONTROL_PERMITIDOS,
  TipoControlPermitido,
} from '../../../common/constants/tipo-control.const';

export class QueryCasosDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsEnum(EstadoCaso)
  estado?: EstadoCaso;

  @IsOptional()
  @IsIn(TIPOS_CONTROL_PERMITIDOS)
  tipoControl?: TipoControlPermitido;

  @IsOptional()
  @IsString()
  operadorId?: string;

  @IsOptional()
  @IsString()
  nacionalidad?: string;

  @IsOptional()
  @IsEnum(Jaf)
  jaf?: Jaf;

  @IsOptional()
  @IsEnum(InstitucionDerivacion)
  institucionDerivacion?: InstitucionDerivacion;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  existenMenores?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
