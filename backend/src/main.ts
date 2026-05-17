import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function normalizeIp(rawIp: string): string {
  const ip = rawIp.trim();
  if (!ip) {
    return '';
  }

  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }

  return ip;
}

function parseAllowedIps(): Set<string> {
  const rawIps = process.env.ALLOWED_IPS?.trim();
  const allowedIps = new Set<string>(['127.0.0.1', '::1']);

  if (!rawIps) {
    return new Set<string>();
  }

  rawIps
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter((ip) => ip.length > 0)
    .forEach((ip) => allowedIps.add(ip));

  return allowedIps;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const rawCorsOrigin = process.env.CORS_ORIGIN?.trim();
  const corsOrigin = rawCorsOrigin
    ? rawCorsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : true;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const allowedIps = parseAllowedIps();
  if (allowedIps.size > 0) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
    app.use((req: Request, res: Response, next: NextFunction) => {
      const forwardedFor = req.headers['x-forwarded-for'];
      const forwardedIp =
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0]
          : undefined;

      const candidateIp =
        forwardedIp ?? req.ip ?? req.socket.remoteAddress ?? '';
      const normalizedIp = normalizeIp(candidateIp);

      if (allowedIps.has(normalizedIp)) {
        return next();
      }

      return res.status(403).json({
        message: 'Acceso no permitido desde esta IP',
      });
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
