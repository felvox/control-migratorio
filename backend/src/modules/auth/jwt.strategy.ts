import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MotivoCierreSesion } from '@prisma/client';

interface JwtPayload {
  sub: string;
  run: string;
  role: string;
  nombreCompleto: string;
  esMaster?: boolean;
  jaf?: string | null;
  sesionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private idleTimeoutMinutes: number;
  private touchIntervalSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'dev_secret'),
    });

    this.idleTimeoutMinutes = configService.get<number>(
      'session.idleTimeoutMinutes',
      30,
    );
    this.touchIntervalSeconds = configService.get<number>(
      'session.touchIntervalSeconds',
      60,
    );

    if (!Number.isFinite(this.idleTimeoutMinutes) || this.idleTimeoutMinutes <= 0) {
      this.idleTimeoutMinutes = 30;
    }

    if (!Number.isFinite(this.touchIntervalSeconds) || this.touchIntervalSeconds <= 0) {
      this.touchIntervalSeconds = 60;
    }
  }

  async validate(payload: JwtPayload) {
    if (!payload.sesionId) {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        activo: true,
        eliminadoAt: null,
      },
      select: {
        id: true,
        run: true,
        rol: true,
        nombreCompleto: true,
        esMaster: true,
        jaf: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    if (
      (['OPERADOR', 'CONSULTA', 'CARABINEROS', 'PDI'].includes(user.rol) ||
        (user.rol === 'ADMINISTRADOR' && !user.esMaster)) &&
      !user.jaf
    ) {
      throw new UnauthorizedException('Usuario sin JAF asignada');
    }

    const sesionActiva = await this.prisma.sesionAcceso.findFirst({
      where: {
        id: payload.sesionId,
        usuarioId: user.id,
        cierreSesion: null,
      },
      select: {
        id: true,
        inicioSesion: true,
        ultimaActividadAt: true,
      },
    });

    if (!sesionActiva) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const ultimaActividad = sesionActiva.ultimaActividadAt ?? sesionActiva.inicioSesion;
    const ahora = new Date();
    const milisegundosInactividad =
      ahora.getTime() - ultimaActividad.getTime();
    const limiteInactividadMs = this.idleTimeoutMinutes * 60 * 1000;

    if (milisegundosInactividad > limiteInactividadMs) {
      await this.prisma.sesionAcceso.update({
        where: { id: payload.sesionId },
        data: {
          cierreSesion: ahora,
          motivoCierre: MotivoCierreSesion.INACTIVIDAD,
        },
      });

      throw new UnauthorizedException('Sesión expirada por inactividad');
    }

    const touchIntervalMs = this.touchIntervalSeconds * 1000;
    if (milisegundosInactividad >= touchIntervalMs) {
      await this.prisma.sesionAcceso.update({
        where: {
          id: payload.sesionId,
        },
        data: {
          ultimaActividadAt: ahora,
        },
      });
    }

    return {
      id: user.id,
      run: user.run,
      role: user.rol,
      nombreCompleto: user.nombreCompleto,
      esMaster: user.esMaster,
      jaf: user.jaf,
      sesionId: payload.sesionId,
    };
  }
}
