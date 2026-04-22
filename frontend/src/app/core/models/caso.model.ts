import { Rol } from './auth.model';

export type TipoControl = 'INGRESO' | 'EGRESO' | 'TERRITORIO';
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
}

export interface DocumentoGenerado {
  id: string;
  casoId: string;
  tipo: string;
  nombreOriginal: string;
  creadoAt: string;
}
