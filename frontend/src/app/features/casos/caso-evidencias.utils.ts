import { Evidencia, PersonaCaso } from '../../core/models/caso.model';
import { Rol } from '../../core/models/auth.model';
import { etiquetaOrigenEvidenciaPorRol } from './casos-presentacion.utils';

const EVIDENCIA_WORD_EXTENSIONS = new Set(['doc', 'docx']);
const EVIDENCIA_EXTENSIONS_PERMITIDAS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']);

export const MIME_TYPES_EVIDENCIA_INSTITUCIONAL = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function esFormatoEvidenciaValido(archivo: File): boolean {
  const extension = obtenerExtensionArchivo(archivo.name);
  return MIME_TYPES_EVIDENCIA_INSTITUCIONAL.has(archivo.type) || EVIDENCIA_EXTENSIONS_PERMITIDAS.has(extension);
}

export function esNombreArchivoWord(nombreArchivo: string): boolean {
  return EVIDENCIA_WORD_EXTENSIONS.has(obtenerExtensionArchivo(nombreArchivo));
}

export function nombrePdfDesdeOriginal(nombreArchivo: string): string {
  const extensionIndex = nombreArchivo.lastIndexOf('.');
  const base = extensionIndex > 0 ? nombreArchivo.slice(0, extensionIndex) : nombreArchivo;
  return `${base || 'documento'}.pdf`;
}

export function extraerNombreArchivoDesdeContentDisposition(value: string | null): string {
  if (!value) {
    return '';
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
  }

  const match = /filename="?([^";]+)"?/i.exec(value);
  return match?.[1]?.trim() ?? '';
}

export function esEvidenciaInstitucionalPorRol(
  evidencia: Evidencia,
  rolInstitucional: Extract<Rol, 'CARABINEROS' | 'PDI'>,
): boolean {
  return evidencia.tipoEvidencia === 'ADJUNTO_GENERAL' && evidencia.creadoPor?.rol === rolInstitucional;
}

export function esEvidenciaCarabineros(evidencia: Evidencia): boolean {
  return esEvidenciaInstitucionalPorRol(evidencia, 'CARABINEROS');
}

export function esEvidenciaPdi(evidencia: Evidencia): boolean {
  return esEvidenciaInstitucionalPorRol(evidencia, 'PDI');
}

export function esEvidenciaInstitucional(evidencia: Evidencia): boolean {
  return esEvidenciaCarabineros(evidencia) || esEvidenciaPdi(evidencia);
}

export function mimeTypePorExtension(nombreArchivo: string): string {
  const extension = obtenerExtensionArchivo(nombreArchivo);

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return '';
  }
}

export function etiquetaPersonaEvidencia(
  evidencia: Evidencia,
  personas: PersonaCaso[] | null | undefined,
): string {
  if (!personas?.length) {
    return 'Caso general';
  }

  if (evidencia.personaId) {
    const persona = personas.find((p) => p.id === evidencia.personaId);
    if (persona) {
      return `${persona.nombres} ${persona.apellidos}`;
    }
  }

  const personaInferida = inferirPersonaPorNombreArchivo(evidencia.nombreOriginal, personas);
  if (personaInferida) {
    return `${personaInferida.nombres} ${personaInferida.apellidos}`;
  }

  return 'Caso general';
}

export function etiquetaOrigenEvidencia(evidencia: Evidencia): string {
  return etiquetaOrigenEvidenciaPorRol(evidencia.creadoPor?.rol);
}

function inferirPersonaPorNombreArchivo(
  nombreArchivo: string,
  personas: PersonaCaso[],
): { nombres: string; apellidos: string } | null {
  const tokensArchivo = new Set(normalizarTextoBusqueda(nombreArchivo).split(' ').filter(Boolean));
  let mejorCoincidencia: { persona: PersonaCaso; puntaje: number } | null = null;

  for (const persona of personas) {
    const tokensPersona = normalizarTextoBusqueda(`${persona.nombres} ${persona.apellidos}`)
      .split(' ')
      .filter((token) => token.length >= 3);

    const puntaje = tokensPersona.filter((token) => tokensArchivo.has(token)).length;
    const tieneNombre = normalizarTextoBusqueda(persona.nombres)
      .split(' ')
      .some((token) => token.length >= 3 && tokensArchivo.has(token));
    const tieneApellido = normalizarTextoBusqueda(persona.apellidos)
      .split(' ')
      .some((token) => token.length >= 3 && tokensArchivo.has(token));

    if (tieneNombre && tieneApellido && (!mejorCoincidencia || puntaje > mejorCoincidencia.puntaje)) {
      mejorCoincidencia = { persona, puntaje };
    }
  }

  return mejorCoincidencia?.persona ?? null;
}

function normalizarTextoBusqueda(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function obtenerExtensionArchivo(nombreArchivo: string): string {
  return nombreArchivo.split('.').pop()?.toLowerCase() ?? '';
}
