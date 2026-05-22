import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Jaf } from '@prisma/client';

export class QueryAuditoriaDto {
  @IsOptional()
  @IsString()
  accion?: string;

  @IsOptional()
  @IsString()
  entidad?: string;

  @IsOptional()
  @IsString()
  acciones?: string;

  @IsOptional()
  @IsString()
  entidades?: string;

  @IsOptional()
  @IsEnum(Jaf)
  jaf?: Jaf;

  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 20;
}
