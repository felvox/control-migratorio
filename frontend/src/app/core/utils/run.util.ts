export function cleanRun(rawRun: string): string {
  return rawRun.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function formatRunForInput(rawRun: string): string {
  const cleaned = cleanRun(rawRun);

  if (!cleaned) {
    return '';
  }

  if (cleaned.length <= 7) {
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  const cuerpo = cleaned.slice(0, -1);
  const digitoVerificador = cleaned.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${cuerpoFormateado}-${digitoVerificador}`;
}

export function formatRunForDisplay(rawRun: string): string {
  const cleaned = cleanRun(rawRun);

  if (!cleaned) {
    return '';
  }

  const cuerpo = cleaned.slice(0, -1);
  const digitoVerificador = cleaned.slice(-1);

  if (!cuerpo) {
    return cleaned;
  }

  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFormateado}-${digitoVerificador}`;
}
