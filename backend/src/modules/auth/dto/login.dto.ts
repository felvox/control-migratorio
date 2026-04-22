import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{7,8}[0-9kK]$|^[0-9]{1,2}(?:\.[0-9]{3}){2}-[0-9kK]$|^[0-9]{7,8}-[0-9kK]$/, {
    message: 'RUN inválido',
  })
  run: string;

  @IsString()
  @MinLength(8)
  password: string;
}
