import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  run: string;
  role: string;
  nombreCompleto: string;
  sesionId?: string;
}

const SESSION_ACTIVITY_WINDOW_MINUTES = 30;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'dev_secret'),
    });
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    const limiteSesionActiva = new Date(
      Date.now() - SESSION_ACTIVITY_WINDOW_MINUTES * 60 * 1000,
    );

    const sesionActiva = await this.prisma.sesionAcceso.findFirst({
      where: {
        id: payload.sesionId,
        usuarioId: user.id,
        cierreSesion: null,
        inicioSesion: {
          gte: limiteSesionActiva,
        },
      },
      select: {
        id: true,
      },
    });

    if (!sesionActiva) {
      throw new UnauthorizedException('Sesión expirada');
    }

    await this.prisma.sesionAcceso.update({
      where: {
        id: payload.sesionId,
      },
      data: {
        inicioSesion: new Date(),
      },
    });

    return {
      id: user.id,
      run: user.run,
      role: user.rol,
      nombreCompleto: user.nombreCompleto,
      sesionId: payload.sesionId,
    };
  }
}
