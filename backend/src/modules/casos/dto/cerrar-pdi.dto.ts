import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const PDI_SITUACIONES_MIGRATORIAS = ['INGRESO_PNH', 'EGRESO_PNH'] as const;
export const PDI_RESULTADOS = [
  'RECONDUCCION',
  'DENUNCIA_SNM_TERRITORIO_NACIONAL',
  'DENUNCIA_SNM_SALIDA_VOLUNTARIA',
  'PUESTA_DISPOSICION_TRIBUNAL',
] as const;

export type PdiSituacionMigratoria = (typeof PDI_SITUACIONES_MIGRATORIAS)[number];
export type PdiResultado = (typeof PDI_RESULTADOS)[number];

export class CerrarPdiDto {
  @IsBoolean()
  ordenJudicialVigente!: boolean;

  @IsOptional()
  @IsIn(PDI_SITUACIONES_MIGRATORIAS)
  situacionMigratoria?: PdiSituacionMigratoria;

  @IsOptional()
  @IsBoolean()
  reconducible?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  observaciones?: string;
}
