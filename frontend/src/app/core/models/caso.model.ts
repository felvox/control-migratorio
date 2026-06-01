import { Jaf, Rol } from './auth.model';

export type TipoControl = 'INGRESO' | 'EGRESO';
export type TipoPersona = 'PRINCIPAL' | 'ACOMPANANTE' | 'MENOR';
export type EstadoCaso =
  | 'PENDIENTE'
  | 'DERIVADO_CARABINEROS'
  | 'DERIVADO_PDI'
  | 'CERRADO';
export type TipoEvidencia =
  | 'FOTO_PERSONA'
  | 'DOCUMENTO_IDENTIDAD'
  | 'ADJUNTO_GENERAL';
export type PdiSituacionMigratoria = 'INGRESO_PNH' | 'EGRESO_PNH';
export type PdiResultado =
  | 'RECONDUCCION'
  | 'DENUNCIA_SNM_TERRITORIO_NACIONAL'
  | 'DENUNCIA_SNM_SALIDA_VOLUNTARIA'
  | 'PUESTA_DISPOSICION_TRIBUNAL';

export interface PersonaCaso {
  id?: string;
  tipoPersona: TipoPersona;
  nombres: string;
  apellidos: string;
  nacionalidad: string;
  fechaNacimiento: string;
  edad: number;
  lugarNacimiento?: string;
  numeroDocumento: string;
  profesionOficio?: string;
  estadoCivil?: string;
  domicilio?: string;
  correo?: string;
  telefono?: string;
}

export interface Caso {
  id: string;
  codigo: string;
  jaf: Jaf;
  tipoControl: TipoControl;
  fechaHoraProcedimiento: string;
  lugar: string;
  coordenadas?: string;
  fechaIngreso?: string;
  documentado: boolean;
  estadoSalud?: string;
  observaciones?: string;
  vieneAcompanado: boolean;
  existenMenores: boolean;
  estado: EstadoCaso;
  institucionDerivacion: 'NINGUNA' | 'CARABINEROS' | 'PDI';
  pdiOrdenJudicialVigente?: boolean | null;
  pdiSituacionMigratoria?: PdiSituacionMigratoria | null;
  pdiReconducible?: boolean | null;
  pdiResultado?: PdiResultado | null;
  pdiObservacionesCierre?: string | null;
  creadoPor: {
    id: string;
    nombreCompleto: string;
    rol: Rol;
  };
  personas: PersonaCaso[];
  evidencias?: Evidencia[];
  documentos?: DocumentoGenerado[];
  creadoAt: string;
}

export interface Evidencia {
  id: string;
  casoId: string;
  personaId?: string;
  tipoEvidencia: TipoEvidencia;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  creadoAt: string;
  creadoPor?: {
    id: string;
    nombreCompleto: string;
    rol: Rol;
  };
}

export interface DocumentoGenerado {
  id: string;
  casoId: string;
  tipo: string;
  nombreOriginal: string;
  creadoAt: string;
}
