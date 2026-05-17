import { Role } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  Matches,
  IsString,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{7,8}[0-9kK]$|^[0-9]{1,2}(?:\.[0-9]{3}){2}-[0-9kK]$|^[0-9]{7,8}-[0-9kK]$/, {
    message: 'RUN inválido',
  })
  run: string;

  @IsString()
  @IsNotEmpty()
  grado: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsEnum(Role)
  rol: Role;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/, {
    message:
      'La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula, número y símbolo.',
  })
  password: string;
}
