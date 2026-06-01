import { IsEnum, IsOptional } from 'class-validator';
import { MotivoCierreSesion } from '@prisma/client';

export class LogoutDto {
  @IsOptional()
  @IsEnum(MotivoCierreSesion)
  motivoCierre?: MotivoCierreSesion;
}
