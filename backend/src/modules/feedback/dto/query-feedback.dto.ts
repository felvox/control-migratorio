import {
  FeedbackDireccion,
  FeedbackEstado,
  FeedbackPrioridad,
  Jaf,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryFeedbackDto {
  @IsOptional()
  @IsEnum(FeedbackEstado)
  estado?: FeedbackEstado;

  @IsOptional()
  @IsEnum(Jaf)
  jaf?: Jaf;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @IsOptional()
  @IsEnum(FeedbackPrioridad)
  prioridad?: FeedbackPrioridad;

  @IsOptional()
  @IsEnum(FeedbackDireccion)
  direccion?: FeedbackDireccion;
}
