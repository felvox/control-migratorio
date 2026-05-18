import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoCaso, InstitucionDerivacion } from '@prisma/client';
import { PersonaCasoDto } from './persona-caso.dto';
import {
  TIPOS_CONTROL_PERMITIDOS,
  TipoControlPermitido,
} from '../../../common/constants/tipo-control.const';

export class UpdateCasoDto {
  @IsOptional()
  @IsIn(TIPOS_CONTROL_PERMITIDOS)
  tipoControl?: TipoControlPermitido;

  @IsOptional()
  @IsDateString()
  fechaHoraProcedimiento?: string;

  @IsOptional()
  @IsString()
  lugar?: string;

  @IsOptional()
  @IsString()
  coordenadas?: string;

  @IsOptional()
  @IsDateString()
  fechaIngreso?: string;

  @IsOptional()
  @IsBoolean()
  documentado?: boolean;

  @IsOptional()
  @IsString()
  estadoSalud?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  vieneAcompanado?: boolean;

  @IsOptional()
  @IsBoolean()
  existenMenores?: boolean;

  @IsOptional()
  @IsEnum(EstadoCaso)
  estado?: EstadoCaso;

  @IsOptional()
  @IsEnum(InstitucionDerivacion)
  institucionDerivacion?: InstitucionDerivacion;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaCasoDto)
  personas?: PersonaCasoDto[];
}
