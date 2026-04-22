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
    const user = await this.prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        activo: true,
        eliminadoAt: null,
      },
      select: {
        id: true,
        run: true,
        email: true,
        rol: true,
        nombreCompleto: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      id: user.id,
      run: user.run,
      email: user.email,
      role: user.rol,
      nombreCompleto: user.nombreCompleto,
      sesionId: payload.sesionId,
    };
  }
}
