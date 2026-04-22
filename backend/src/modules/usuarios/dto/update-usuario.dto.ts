import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{7,8}[0-9kK]$|^[0-9]{1,2}(?:\.[0-9]{3}){2}-[0-9kK]$|^[0-9]{7,8}-[0-9kK]$/, {
    message: 'RUN inválido',
  })
  run?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @IsOptional()
  @IsEnum(Role)
  rol?: Role;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
