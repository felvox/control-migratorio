import { FeedbackPrioridad, Jaf } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  asunto!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  mensaje!: string;

  @IsOptional()
  @IsEnum(FeedbackPrioridad)
  prioridad?: FeedbackPrioridad;

  @IsOptional()
  @IsEnum(Jaf)
  jafDestino?: Jaf;
}
