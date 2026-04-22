import { TipoEvidencia } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadEvidenciaDto {
  @IsEnum(TipoEvidencia)
  tipoEvidencia: TipoEvidencia;

  @IsOptional()
  @IsString()
  personaId?: string;
}
