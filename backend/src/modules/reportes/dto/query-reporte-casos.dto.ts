import { EstadoCaso } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  TIPOS_CONTROL_PERMITIDOS,
  TipoControlPermitido,
} from '../../../common/constants/tipo-control.const';

export class QueryReporteCasosDto {
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsEnum(EstadoCaso)
  estado?: EstadoCaso;

  @IsOptional()
  @IsString()
  operadorId?: string;

  @IsOptional()
  @IsIn(TIPOS_CONTROL_PERMITIDOS)
  tipoControl?: TipoControlPermitido;

  @IsOptional()
  @IsString()
  nacionalidad?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;
}
