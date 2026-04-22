import { EstadoCaso, InstitucionDerivacion } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class CambiarEstadoCasoDto {
  @IsEnum(EstadoCaso)
  estado: EstadoCaso;

  @IsOptional()
  @IsEnum(InstitucionDerivacion)
  institucionDerivacion?: InstitucionDerivacion;
}
