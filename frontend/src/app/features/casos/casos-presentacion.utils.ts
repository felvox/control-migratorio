import {
  EstadoCaso,
  PdiResultado,
  PdiSituacionMigratoria,
  TipoControl,
  TipoEvidencia,
  TipoPersona,
} from '../../core/models/caso.model';
import { Jaf, Rol } from '../../core/models/auth.model';

export type EstadoClaseCss =
  | 'status-derivado-carabineros'
  | 'status-derivado-pdi'
  | 'status-cerrado'
  | 'status-pendiente';

export function etiquetaEstado(estado: EstadoCaso | string): string {
  switch (estado) {
    case 'DERIVADO_CARABINEROS':
      return 'Derivado a Carabineros';
    case 'DERIVADO_PDI':
      return 'Derivado a PDI';
    case 'CERRADO':
      return 'Cerrado';
    default:
      return 'Pendiente';
  }
}

export function estadoClase(estado: EstadoCaso | string): EstadoClaseCss {
  switch (estado) {
    case 'DERIVADO_CARABINEROS':
      return 'status-derivado-carabineros';
    case 'DERIVADO_PDI':
      return 'status-derivado-pdi';
    case 'CERRADO':
      return 'status-cerrado';
    default:
      return 'status-pendiente';
  }
}

export function etiquetaTipoControl(tipoControl: TipoControl | string): string {
  switch (tipoControl) {
    case 'INGRESO':
      return 'Ingresando';
    case 'EGRESO':
      return 'Egresando';
    default:
      return 'No informado';
  }
}

export function etiquetaJaf(jaf: Jaf | string): string {
  switch (jaf) {
    case 'TARAPACA':
      return 'JAF Tarapacá';
    case 'ANTOFAGASTA':
      return 'JAF Antofagasta';
    case 'ARICA_PARINACOTA':
      return 'JAF Arica y Parinacota';
    default:
      return String(jaf);
  }
}

export function etiquetaTipoEvidencia(tipo: TipoEvidencia | string): string {
  switch (tipo) {
    case 'DOCUMENTO_IDENTIDAD':
      return 'Documento de identidad';
    case 'FOTO_PERSONA':
      return 'Fotografía de persona';
    default:
      return 'Adjunto general';
  }
}

export function etiquetaTipoPersona(tipo: TipoPersona | string): string {
  switch (tipo) {
    case 'PRINCIPAL':
      return 'Adulto principal';
    case 'MENOR':
      return 'Menor de edad';
    default:
      return 'Acompañante';
  }
}

export function etiquetaOrigenEvidenciaPorRol(rol?: Rol | null): string {
  switch (rol) {
    case 'CARABINEROS':
      return 'Carabineros';
    case 'PDI':
      return 'PDI';
    default:
      return 'Ejército';
  }
}

export function etiquetaSituacionMigratoriaPdi(
  situacion: PdiSituacionMigratoria | '' | null | undefined,
): string {
  switch (situacion) {
    case 'INGRESO_PNH':
      return 'Ingreso por paso no habilitado';
    case 'EGRESO_PNH':
      return 'Egreso por paso no habilitado';
    default:
      return 'No aplica';
  }
}

export function etiquetaResultadoPdi(resultado: PdiResultado | '' | null | undefined): string {
  switch (resultado) {
    case 'RECONDUCCION':
      return 'Reconducción';
    case 'DENUNCIA_SNM_TERRITORIO_NACIONAL':
      return 'Denuncia al Servicio Nacional de Migraciones y permanencia en territorio nacional';
    case 'DENUNCIA_SNM_SALIDA_VOLUNTARIA':
      return 'Denuncia al Servicio Nacional de Migraciones y salida voluntaria';
    case 'PUESTA_DISPOSICION_TRIBUNAL':
      return 'Puesta a disposición del tribunal';
    default:
      return 'Pendiente';
  }
}

export function etiquetaReconduciblePdi(valor: boolean | null | undefined): string {
  if (valor === true) {
    return 'Sí';
  }

  if (valor === false) {
    return 'No';
  }

  return 'No aplica';
}

export function etiquetaOrdenJudicialPdi(valor: boolean | null | undefined): string {
  if (valor === true) {
    return 'Sí';
  }

  if (valor === false) {
    return 'No';
  }

  return 'No registrado';
}
