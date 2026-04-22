import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoCaso, InstitucionDerivacion, TipoControl } from '@prisma/client';
import { PersonaCasoDto } from './persona-caso.dto';

export class UpdateCasoDto {
  @IsOptional()
  @IsEnum(TipoControl)
  tipoControl?: TipoControl;

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
