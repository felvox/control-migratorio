import { TipoEvidencia } from '@prisma/client';

export interface FuncionarioDesglosado {
  grado: string;
  nombre: string;
}

export interface EvidenciaAnexo {
  tipoEvidencia: TipoEvidencia;
  creadoAt: Date;
}

export function etiquetaTipoControl(tipo: string): string {
  if (tipo === 'INGRESO') {
    return 'Ingresando a territorio nacional';
  }

  if (tipo === 'EGRESO') {
    return 'Egresando de territorio nacional';
  }

  return 'No informado';
}

export function etiquetaEstado(estado: string): string {
  if (estado === 'DERIVADO_CARABINEROS') {
    return 'Derivado Carabineros';
  }

  if (estado === 'DERIVADO_PDI') {
    return 'Derivado PDI';
  }

  if (estado === 'CERRADO') {
    return 'Cerrado';
  }

  return 'Pendiente';
}

export function etiquetaInstitucion(institucion: string): string {
  if (institucion === 'CARABINEROS') {
    return 'Carabineros';
  }

  if (institucion === 'PDI') {
    return 'PDI';
  }

  return 'Ninguna';
}

export function etiquetaJaf(jaf: string): string {
  if (jaf === 'TARAPACA') {
    return 'JAF Tarapacá';
  }

  if (jaf === 'ANTOFAGASTA') {
    return 'JAF Antofagasta';
  }

  if (jaf === 'ARICA_PARINACOTA') {
    return 'JAF Arica y Parinacota';
  }

  return jaf;
}

export function formatearFechaHora(fecha: Date | string): string {
  const fechaValida = parseFecha(fecha);
  if (!fechaValida) {
    return '';
  }

  return fechaValida.toLocaleString('es-CL');
}

export function formatearFecha(fecha: Date | string): string {
  const fechaValida = parseFecha(fecha);
  if (!fechaValida) {
    return '';
  }

  const dia = String(fechaValida.getUTCDate()).padStart(2, '0');
  const mes = String(fechaValida.getUTCMonth() + 1).padStart(2, '0');
  const ano = fechaValida.getUTCFullYear();

  return `${dia}-${mes}-${ano}`;
}

export function formatearHora(fecha: Date | string): string {
  const fechaValida = parseFecha(fecha);
  if (!fechaValida) {
    return '';
  }

  return fechaValida.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatearMesAbreviadoMayuscula(fecha: Date | string): string {
  const fechaValida = parseFecha(fecha);
  if (!fechaValida) {
    return '';
  }

  return fechaValida
    .toLocaleDateString('es-CL', { month: 'short' })
    .replace('.', '')
    .trim()
    .toUpperCase();
}

export function detectarLesiones(estadoSalud: string | null | undefined): boolean {
  if (!estadoSalud) {
    return false;
  }

  const normalizado = estadoSalud
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalizado.includes('sin lesion')) {
    return false;
  }

  return normalizado.includes('lesion');
}

export function limpiarObservacionesParaActa(observaciones: string | null | undefined): string {
  if (!observaciones) {
    return '';
  }

  const marcadorConformidad = '[CONFORMIDAD_SISTEMA]';
  const markerIndex = observaciones.indexOf(marcadorConformidad);

  if (markerIndex < 0) {
    return observaciones.trim();
  }

  return observaciones.slice(0, markerIndex).trim();
}

export function separarGradoYNombreFuncionario(
  nombreCompleto: string | null | undefined,
): FuncionarioDesglosado {
  const limpio = (nombreCompleto ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) {
    return { grado: '', nombre: '' };
  }

  const gradosCompuestos = [
    'General de Ejército',
    'General de División',
    'General de Brigada',
    'Teniente Coronel',
    'Sub Oficial Mayor',
    'Sub Oficial',
    'Sargento Primero',
    'Sargento Segundo',
    'Cabo Primero',
    'Cabo Segundo',
  ];

  const limpioLower = limpio.toLowerCase();
  const gradoCompuesto = gradosCompuestos.find((grado) =>
    limpioLower.startsWith(grado.toLowerCase()),
  );

  if (gradoCompuesto) {
    return {
      grado: gradoCompuesto,
      nombre: limpio.slice(gradoCompuesto.length).trim(),
    };
  }

  const partes = limpio.split(' ');
  if (partes.length === 1) {
    return { grado: partes[0] ?? '', nombre: '' };
  }

  return {
    grado: partes[0] ?? '',
    nombre: partes.slice(1).join(' ').trim(),
  };
}

export function ordenarEvidenciasParaAnexo<T extends EvidenciaAnexo>(evidencias: T[]): T[] {
  const prioridadTipo: Record<TipoEvidencia, number> = {
    [TipoEvidencia.DOCUMENTO_IDENTIDAD]: 0,
    [TipoEvidencia.FOTO_PERSONA]: 1,
    [TipoEvidencia.ADJUNTO_GENERAL]: 2,
  };

  return [...evidencias].sort((a, b) => {
    const prioridadA = prioridadTipo[a.tipoEvidencia] ?? 99;
    const prioridadB = prioridadTipo[b.tipoEvidencia] ?? 99;

    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }

    return a.creadoAt.getTime() - b.creadoAt.getTime();
  });
}

export function tituloTipoEvidencia(tipo: TipoEvidencia): string {
  if (tipo === TipoEvidencia.DOCUMENTO_IDENTIDAD) {
    return 'Documento de identidad';
  }

  if (tipo === TipoEvidencia.FOTO_PERSONA) {
    return 'Fotografía de persona';
  }

  return 'Adjunto general';
}

function parseFecha(fecha: Date | string): Date | null {
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
