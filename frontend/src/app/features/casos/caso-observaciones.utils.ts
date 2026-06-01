export interface ObservacionInstitucionalDetalle {
  origen: string;
  fecha: string;
  texto: string;
}

export function extraerObservacionesBase(observaciones: string | null | undefined): string {
  if (!observaciones) {
    return '';
  }

  return observaciones
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .filter((linea) => !linea.startsWith('[CONFORMIDAD_SISTEMA]'))
    .filter((linea) => !linea.startsWith('[OBS_'))
    .join('\n');
}

export function extraerObservacionesInstitucionales(
  observaciones: string | null | undefined,
): string[] {
  if (!observaciones) {
    return [];
  }

  return observaciones
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('[OBS_'));
}

export function construirBitacoraInstitucional(
  observaciones: string | null | undefined,
  fechaCreacionCaso?: string | Date | null,
): ObservacionInstitucionalDetalle[] {
  const bitacora: Array<ObservacionInstitucionalDetalle & { orden: number; idx: number }> = [];
  let idx = 0;

  const base = extraerObservacionesBase(observaciones).trim();
  const fechaBase = fechaCreacionCaso ? new Date(fechaCreacionCaso) : null;
  if (base) {
    bitacora.push({
      origen: 'Ejército',
      fecha:
        fechaBase && !Number.isNaN(fechaBase.getTime())
          ? fechaBase.toLocaleString('es-CL')
          : '',
      texto: base,
      orden:
        fechaBase && !Number.isNaN(fechaBase.getTime())
          ? fechaBase.getTime()
          : 0,
      idx: idx++,
    });
  }

  extraerObservacionesInstitucionales(observaciones).forEach((linea) => {
    const parsed = parsearObservacionInstitucional(linea);
    bitacora.push({
      ...parsed,
      orden: obtenerFechaOrdenObservacion(linea),
      idx: idx++,
    });
  });

  return bitacora
    .sort((a, b) => {
      if (a.orden !== b.orden) {
        return a.orden - b.orden;
      }
      return a.idx - b.idx;
    })
    .map(({ origen, fecha, texto }) => ({ origen, fecha, texto }));
}

export function parsearObservacionInstitucional(
  linea: string,
): ObservacionInstitucionalDetalle {
  const match = /^\[OBS_([A-Z_]+)\s+([^\]]+)\]\s*(.*)$/u.exec(linea);
  if (!match) {
    return {
      origen: 'Institucional',
      fecha: '',
      texto: linea.trim(),
    };
  }

  const origenRaw = match[1] ?? '';
  const fechaRaw = match[2] ?? '';
  const textoRaw = match[3] ?? '';
  const fechaParseada = new Date(fechaRaw);

  return {
    origen: etiquetaOrigenObservacion(origenRaw),
    fecha: Number.isNaN(fechaParseada.getTime())
      ? fechaRaw
      : fechaParseada.toLocaleString('es-CL'),
    texto: textoRaw.trim() || 'Sin detalle',
  };
}

function etiquetaOrigenObservacion(origenRaw: string): string {
  if (origenRaw === 'CARABINEROS') {
    return 'Carabineros';
  }

  if (origenRaw === 'PDI') {
    return 'PDI';
  }

  if (origenRaw === 'ADMINISTRADOR') {
    return 'Administrador';
  }

  return 'Institucional';
}

function obtenerFechaOrdenObservacion(linea: string): number {
  const match = /^\[OBS_[A-Z_]+\s+([^\]]+)\]/u.exec(linea);
  if (!match?.[1]) {
    return Number.MAX_SAFE_INTEGER;
  }

  const fecha = new Date(match[1]);
  if (Number.isNaN(fecha.getTime())) {
    return Number.MAX_SAFE_INTEGER;
  }

  return fecha.getTime();
}
