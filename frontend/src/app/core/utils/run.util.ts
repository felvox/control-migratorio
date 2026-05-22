export function cleanRun(rawRun: string): string {
  return rawRun.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
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
  const cleaned = cleanRun(rawRun);

  if (!/^\d{7,8}[\dK]$/.test(cleaned)) {
    return false;
  }

  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  return calcularDigitoVerificador(cuerpo) === dv;
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
