import { Request } from 'express';

function normalizarIp(ip: string | undefined | null): string | undefined {
  if (!ip) {
    return undefined;
  }

  const valor = ip.trim();
  if (!valor) {
    return undefined;
  }

  if (valor.startsWith('::ffff:')) {
    return valor.slice(7);
  }

  if (valor === '::1') {
    return '127.0.0.1';
  }

  return valor;
}

export function obtenerIpCliente(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const primeraIp = forwarded.split(',')[0]?.trim();
    const normalizada = normalizarIp(primeraIp);
    if (normalizada) {
      return normalizada;
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    const normalizada = normalizarIp(realIp);
    if (normalizada) {
      return normalizada;
    }
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim().length > 0) {
    const normalizada = normalizarIp(cfConnectingIp);
    if (normalizada) {
      return normalizada;
    }
  }

  return (
    normalizarIp(req.ip) ??
    normalizarIp(req.socket?.remoteAddress) ??
    undefined
  );
}
