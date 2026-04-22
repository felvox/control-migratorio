import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoControl } from '@prisma/client';
import { PersonaCasoDto } from './persona-caso.dto';

export class CreateCasoDto {
  @IsEnum(TipoControl)
  tipoControl: TipoControl;

  @IsDateString()
  fechaHoraProcedimiento: string;

  @IsString()
  @MinLength(2)
  lugar: string;

  @IsOptional()
  @IsString()
  coordenadas?: string;

  @IsOptional()
  @IsDateString()
  fechaIngreso?: string;

  @IsBoolean()
  documentado: boolean;

  @IsOptional()
  @IsString()
  estadoSalud?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsBoolean()
  vieneAcompanado: boolean;

  @IsBoolean()
  existenMenores: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaCasoDto)
  personas: PersonaCasoDto[];
}
