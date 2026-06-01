import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MotivoCierreSesion, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TransferMasterDto } from './dto/transfer-master.dto';
import { comparePassword, hashPassword } from '../../common/utils/password.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { normalizeRun } from '../../common/utils/run.util';

interface LoginMetadata {
  motivo?: MotivoCierreSesion;
  ip?: string;
  userAgent?: string;
}

interface LoginAttemptState {
  count: number;
  firstAttemptAt: number;
  lastFailureAt: number;
  lockedUntilAt?: number;
}

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, LoginAttemptState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, metadata: LoginMetadata) {
    await this.cerrarSesionesExpiradasPorInactividad();

    const runNormalizado = normalizeRun(loginDto.run);
    const attemptKey = this.construirLlaveIntento(runNormalizado, metadata.ip);
    this.limpiarIntentosExpirados();

    if (this.estaLoginBloqueado(attemptKey)) {
      await this.auditoriaService.registrarAccion({
        accion: 'LOGIN_BLOQUEADO_TEMPORAL',
        entidad: 'AUTH',
        descripcion: `Intento bloqueado por seguridad para RUN ${runNormalizado}`,
        metadata: {
          run: runNormalizado,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        },
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      throw new HttpException(
        'Demasiados intentos fallidos. Intenta nuevamente en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        eliminadoAt: null,
        activo: true,
        run: runNormalizado,
      },
    });

    if (!usuario) {
      await this.registrarIntentoFallido({
        attemptKey,
        run: runNormalizado,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await comparePassword(
      loginDto.password,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      await this.registrarIntentoFallido({
        attemptKey,
        run: runNormalizado,
        usuarioId: usuario.id,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.loginAttempts.delete(attemptKey);

    const requiereJaf =
      usuario.rol === Role.OPERADOR ||
      usuario.rol === Role.CONSULTA ||
      usuario.rol === Role.CARABINEROS ||
      usuario.rol === Role.PDI ||
      (usuario.rol === Role.ADMINISTRADOR && !usuario.esMaster);

    if (requiereJaf && !usuario.jaf) {
      throw new UnauthorizedException(
        'Usuario sin JAF asignada. Contacte a un administrador.',
      );
    }

    if (this.aplicaBloqueoSesionAdminUnica()) {
      const ventanaAdminMinutos = this.configService.get<number>(
        'session.adminSingleSessionWindowMinutes',
        30,
      );
      const ventanaValida = Number.isFinite(ventanaAdminMinutos)
        ? Math.max(1, ventanaAdminMinutos)
        : 30;
      const limiteSesionActiva = new Date(
        Date.now() - ventanaValida * 60 * 1000,
      );

      const sesionAdminActiva = await this.prisma.sesionAcceso.findFirst({
        where: {
          cierreSesion: null,
          OR: [
            {
              ultimaActividadAt: {
                gte: limiteSesionActiva,
              },
            },
          ],
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
    }

    await this.prisma.sesionAcceso.updateMany({
      where: {
        usuarioId: usuario.id,
        cierreSesion: null,
      },
      data: {
        cierreSesion: new Date(),
        motivoCierre: MotivoCierreSesion.FORZADO,
      },
    });

    await this.registrarAlertaCambioIpSiCorresponde({
      usuarioId: usuario.id,
      run: usuario.run,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
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
      esMaster: usuario.esMaster,
      jaf: usuario.jaf,
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
        esMaster: usuario.esMaster,
        jaf: usuario.jaf,
      },
    };
  }

  async logout(usuarioId: string, sesionId?: string, metadata?: LoginMetadata) {
    if (sesionId) {
      await this.auditoriaService.registrarCierreSesion({
        sesionId,
        usuarioId,
        motivo: metadata?.motivo,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      });
      return;
    }

    await this.prisma.sesionAcceso.updateMany({
      where: {
        usuarioId,
        cierreSesion: null,
      },
      data: {
        cierreSesion: new Date(),
        motivoCierre: metadata?.motivo ?? MotivoCierreSesion.LOGOUT,
      },
    });
  }

  private aplicaBloqueoSesionAdminUnica(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private construirLlaveIntento(run: string, ip?: string): string {
    return `${run}|${ip ?? 'sin_ip'}`;
  }

  private async registrarAlertaCambioIpSiCorresponde(params: {
    usuarioId: string;
    run: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const ipActual = this.normalizarIp(params.ip);
    if (!ipActual) {
      return;
    }

    const ipsHistoricas = await this.prisma.sesionAcceso.findMany({
      where: {
        usuarioId: params.usuarioId,
        ip: {
          not: null,
        },
      },
      select: {
        ip: true,
      },
      distinct: ['ip'],
      take: 50,
    });

    const ipsNormalizadas = ipsHistoricas
      .map((item) => this.normalizarIp(item.ip ?? undefined))
      .filter((ip): ip is string => Boolean(ip));

    if (!ipsNormalizadas.length) {
      return;
    }

    const ipYaConocida = ipsNormalizadas.includes(ipActual);
    if (ipYaConocida) {
      return;
    }

    await this.auditoriaService.registrarAccion({
      usuarioId: params.usuarioId,
      accion: 'LOGIN_IP_NUEVA',
      entidad: 'AUTH',
      descripcion: `Inicio de sesión desde IP no reconocida para RUN ${params.run}`,
      metadata: {
        run: params.run,
        ipNueva: ipActual,
        ipsPrevias: ipsNormalizadas,
      },
      ip: ipActual,
      userAgent: params.userAgent,
    });
  }

  private normalizarIp(ip?: string): string | null {
    if (!ip) {
      return null;
    }

    const normalizada = ip.trim().replace(/^::ffff:/, '');
    return normalizada.length > 0 ? normalizada : null;
  }

  private obtenerPoliticaLogin() {
    const maxAttempts = Math.max(
      3,
      this.configService.get<number>('security.loginMaxAttempts', 5) ?? 5,
    );
    const windowMinutes = Math.max(
      1,
      this.configService.get<number>('security.loginWindowMinutes', 10) ?? 10,
    );
    const lockoutMinutes = Math.max(
      1,
      this.configService.get<number>('security.loginLockoutMinutes', 15) ?? 15,
    );

    return { maxAttempts, windowMinutes, lockoutMinutes };
  }

  private estaLoginBloqueado(attemptKey: string): boolean {
    const state = this.loginAttempts.get(attemptKey);
    if (!state?.lockedUntilAt) {
      return false;
    }

    const now = Date.now();
    if (state.lockedUntilAt <= now) {
      this.loginAttempts.delete(attemptKey);
      return false;
    }

    return true;
  }

  private limpiarIntentosExpirados(): void {
    const { windowMinutes, lockoutMinutes } = this.obtenerPoliticaLogin();
    const now = Date.now();
    const threshold =
      now - Math.max(windowMinutes, lockoutMinutes) * 60 * 1000;

    for (const [key, state] of this.loginAttempts.entries()) {
      if ((state.lockedUntilAt ?? 0) > now) {
        continue;
      }

      if (state.lastFailureAt < threshold) {
        this.loginAttempts.delete(key);
      }
    }
  }

  private async registrarIntentoFallido(params: {
    attemptKey: string;
    run: string;
    usuarioId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const { maxAttempts, windowMinutes, lockoutMinutes } =
      this.obtenerPoliticaLogin();
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const lockoutMs = lockoutMinutes * 60 * 1000;

    const current = this.loginAttempts.get(params.attemptKey);
    let state: LoginAttemptState;

    if (!current || now - current.firstAttemptAt > windowMs) {
      state = {
        count: 1,
        firstAttemptAt: now,
        lastFailureAt: now,
      };
    } else {
      state = {
        ...current,
        count: current.count + 1,
        lastFailureAt: now,
      };
    }

    if (state.count >= maxAttempts) {
      state.lockedUntilAt = now + lockoutMs;
    }

    this.loginAttempts.set(params.attemptKey, state);

    await this.auditoriaService.registrarAccion({
      usuarioId: params.usuarioId,
      accion: 'LOGIN_FALLIDO',
      entidad: 'AUTH',
      descripcion: `Intento de login fallido para RUN ${params.run}`,
      metadata: {
        run: params.run,
        intentosFallidos: state.count,
        bloqueadoHasta: state.lockedUntilAt
          ? new Date(state.lockedUntilAt).toISOString()
          : null,
        ip: params.ip,
        userAgent: params.userAgent,
      },
      ip: params.ip,
      userAgent: params.userAgent,
    });

    if (state.lockedUntilAt) {
      await this.auditoriaService.registrarAccion({
        usuarioId: params.usuarioId,
        accion: 'LOGIN_BLOQUEADO_TEMPORAL',
        entidad: 'AUTH',
        descripcion: `Bloqueo temporal de login para RUN ${params.run}`,
        metadata: {
          run: params.run,
          bloqueadoHasta: new Date(state.lockedUntilAt).toISOString(),
          ip: params.ip,
          userAgent: params.userAgent,
        },
        ip: params.ip,
        userAgent: params.userAgent,
      });
    }
  }

  private async cerrarSesionesExpiradasPorInactividad(): Promise<void> {
    const idleTimeoutMinutes = Math.max(
      1,
      this.configService.get<number>('session.idleTimeoutMinutes', 30) ?? 30,
    );
    const ahora = new Date();
    const limiteInactividad = new Date(
      ahora.getTime() - idleTimeoutMinutes * 60 * 1000,
    );

    await this.prisma.sesionAcceso.updateMany({
      where: {
        cierreSesion: null,
        ultimaActividadAt: {
          lt: limiteInactividad,
        },
      },
      data: {
        cierreSesion: ahora,
        motivoCierre: MotivoCierreSesion.INACTIVIDAD,
      },
    });
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
        esMaster: true,
        jaf: true,
        activo: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no válido');
    }

    return user;
  }

  async changePassword(
    usuarioId: string,
    dto: ChangePasswordDto,
    metadata?: LoginMetadata,
  ) {
    if (dto.passwordActual === dto.nuevaPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        eliminadoAt: null,
        activo: true,
      },
      select: {
        id: true,
        run: true,
        passwordHash: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const passwordValida = await comparePassword(
      dto.passwordActual,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Contraseña actual inválida');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: await hashPassword(dto.nuevaPassword),
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: usuario.id,
      accion: 'CAMBIAR_PASSWORD_PROPIA',
      entidad: 'AUTH',
      entidadId: usuario.id,
      descripcion: `Cambio de contraseña propia del usuario RUN ${usuario.run}`,
      ip: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }

  async listMasterCandidates(currentUserId: string) {
    return this.prisma.usuario.findMany({
      where: {
        eliminadoAt: null,
        activo: true,
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
        rol: true,
        esMaster: true,
      },
      orderBy: {
        nombreCompleto: 'asc',
      },
    });
  }

  async transferMaster(
    currentUserId: string,
    dto: TransferMasterDto,
    metadata?: LoginMetadata,
  ) {
    if (dto.targetUserId === currentUserId) {
      throw new BadRequestException('Debes seleccionar otro usuario');
    }

    const actor = await this.prisma.usuario.findFirst({
      where: {
        id: currentUserId,
        eliminadoAt: null,
        activo: true,
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
        esMaster: true,
        passwordHash: true,
      },
    });

    if (!actor) {
      throw new UnauthorizedException('Usuario no válido');
    }

    if (!actor.esMaster) {
      throw new ForbiddenException(
        'Solo el administrador master puede traspasar la cuenta',
      );
    }

    const passwordValida = await comparePassword(
      dto.passwordActual,
      actor.passwordHash,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Contraseña actual inválida');
    }

    const target = await this.prisma.usuario.findFirst({
      where: {
        id: dto.targetUserId,
        eliminadoAt: null,
        activo: true,
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
      },
    });

    if (!target) {
      throw new BadRequestException('Usuario destino no disponible');
    }

    const fechaEliminacionAnteriorMaster = new Date();

    await this.prisma.$transaction([
      this.prisma.usuario.updateMany({
        where: {
          esMaster: true,
        },
        data: {
          esMaster: false,
        },
      }),
      this.prisma.usuario.update({
        where: {
          id: target.id,
        },
        data: {
          rol: Role.ADMINISTRADOR,
          jaf: null,
          esMaster: true,
        },
      }),
      this.prisma.usuario.updateMany({
        where: {
          esMaster: true,
          id: {
            not: target.id,
          },
        },
        data: {
          esMaster: false,
        },
      }),
      this.prisma.usuario.update({
        where: {
          id: actor.id,
        },
        data: {
          esMaster: false,
          activo: false,
          eliminadoAt: fechaEliminacionAnteriorMaster,
        },
      }),
      this.prisma.sesionAcceso.updateMany({
        where: {
          usuarioId: actor.id,
          cierreSesion: null,
        },
        data: {
          cierreSesion: fechaEliminacionAnteriorMaster,
          motivoCierre: MotivoCierreSesion.FORZADO,
        },
      }),
      this.prisma.auditoria.create({
        data: {
          usuarioId: actor.id,
          accion: 'TRASPASAR_ADMIN_MASTER',
          entidad: 'USUARIO',
          entidadId: target.id,
          descripcion: `Master transferido de ${actor.nombreCompleto} a ${target.nombreCompleto}`,
          ip: metadata?.ip,
          userAgent: metadata?.userAgent,
          fechaHora: new Date(),
        },
      }),
    ]);

    return {
      message: `Cuenta master transferida a ${target.nombreCompleto}`,
    };
  }
}
