import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { comparePassword } from '../../common/utils/password.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { normalizeRun } from '../../common/utils/run.util';

interface LoginMetadata {
  ip?: string;
  userAgent?: string;
}

const ADMIN_SESSION_ACTIVITY_WINDOW_MINUTES = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async login(loginDto: LoginDto, metadata: LoginMetadata) {
    const runNormalizado = normalizeRun(loginDto.run);

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        eliminadoAt: null,
        activo: true,
        run: runNormalizado,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await comparePassword(
      loginDto.password,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const limiteSesionActiva = new Date(
      Date.now() - ADMIN_SESSION_ACTIVITY_WINDOW_MINUTES * 60 * 1000,
    );

    const sesionAdminActiva = await this.prisma.sesionAcceso.findFirst({
      where: {
        cierreSesion: null,
        inicioSesion: {
          gte: limiteSesionActiva,
        },
        usuarioId: {
          not: usuario.id,
        },
        usuario: {
          rol: Role.ADMINISTRADOR,
          activo: true,
          eliminadoAt: null,
        },
      },
      select: {
        id: true,
      },
    });

    if (sesionAdminActiva) {
      throw new UnauthorizedException(
        'Acceso restringido: existe una sesión activa de administrador',
      );
    }

    await this.prisma.sesionAcceso.updateMany({
      where: {
        usuarioId: usuario.id,
        cierreSesion: null,
      },
      data: {
        cierreSesion: new Date(),
      },
    });

    const sesionId = await this.auditoriaService.registrarInicioSesion({
      usuarioId: usuario.id,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
    });

    const payload = {
      sub: usuario.id,
      run: usuario.run,
      role: usuario.rol,
      nombreCompleto: usuario.nombreCompleto,
      sesionId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: usuario.id,
        run: usuario.run,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
      },
    };
  }

  async logout(usuarioId: string, sesionId?: string, metadata?: LoginMetadata) {
    if (sesionId) {
      await this.auditoriaService.registrarCierreSesion({
        sesionId,
        usuarioId,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      });
    }
  }

  async me(usuarioId: string) {
    const user = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        eliminadoAt: null,
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
        rol: true,
        activo: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no válido');
    }

    return user;
  }
}
