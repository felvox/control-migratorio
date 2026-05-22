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

function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);

  if (resto === 11) {
    return '0';
  }

  if (resto === 10) {
    return 'K';
  }

  return String(resto);
}

export function isRunChilenoValido(rawRun: string): boolean {
  const normalized = normalizeRun(rawRun);

  if (!/^\d{7,8}-[\dK]$/.test(normalized)) {
    return false;
  }

  const [cuerpo, dv] = normalized.split('-');

  if (!cuerpo || !dv) {
    return false;
  }

  return calcularDigitoVerificador(cuerpo) === dv;
}
