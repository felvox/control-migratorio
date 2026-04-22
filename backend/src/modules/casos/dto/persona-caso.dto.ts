import { TipoPersona } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PersonaCasoDto {
  @IsEnum(TipoPersona)
  tipoPersona: TipoPersona;

  @IsString()
  nombres: string;

  @IsString()
  apellidos: string;

  @IsString()
  nacionalidad: string;

  @IsDateString()
  fechaNacimiento: string;

  @IsInt()
  @Min(0)
  @Max(120)
  edad: number;

  @IsOptional()
  @IsString()
  lugarNacimiento?: string;

  @IsString()
  numeroDocumento: string;

  @IsOptional()
  @IsString()
  profesionOficio?: string;

  @IsOptional()
  @IsString()
  estadoCivil?: string;

  @IsOptional()
  @IsString()
  domicilio?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
