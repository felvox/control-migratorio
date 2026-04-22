export function normalizeRun(rawRun: string): string {
  const cleaned = rawRun.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

  if (cleaned.length < 2) {
    return cleaned;
  }

  const cuerpo = cleaned.slice(0, -1);
  const digitoVerificador = cleaned.slice(-1);

  return `${cuerpo}-${digitoVerificador}`;
}

export function isRunFormatValid(rawRun: string): boolean {
  const normalized = normalizeRun(rawRun);
  return /^\d{7,8}-[\dK]$/.test(normalized);
}
