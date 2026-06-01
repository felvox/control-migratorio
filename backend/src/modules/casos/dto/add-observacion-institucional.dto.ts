import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddObservacionInstitucionalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1200)
  observacion!: string;
}

