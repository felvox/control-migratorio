export const TIPOS_CONTROL_PERMITIDOS = ['INGRESO', 'EGRESO'] as const;

export type TipoControlPermitido = (typeof TIPOS_CONTROL_PERMITIDOS)[number];

