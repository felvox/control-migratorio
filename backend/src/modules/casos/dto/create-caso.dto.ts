import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PersonaCasoDto } from './persona-caso.dto';
import {
  TIPOS_CONTROL_PERMITIDOS,
  TipoControlPermitido,
} from '../../../common/constants/tipo-control.const';

export class CreateCasoDto {
  @IsIn(TIPOS_CONTROL_PERMITIDOS)
  tipoControl: TipoControlPermitido;

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
