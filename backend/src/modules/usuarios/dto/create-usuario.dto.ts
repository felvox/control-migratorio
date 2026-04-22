import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{7,8}[0-9kK]$|^[0-9]{1,2}(?:\.[0-9]{3}){2}-[0-9kK]$|^[0-9]{7,8}-[0-9kK]$/, {
    message: 'RUN inválido',
  })
  run: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @IsEnum(Role)
  rol: Role;

  @IsString()
  @MinLength(8)
  password: string;
}
