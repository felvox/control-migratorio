import { IsString, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/, {
    message:
      'La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula, número y símbolo.',
  })
  nuevaPassword: string;
}

