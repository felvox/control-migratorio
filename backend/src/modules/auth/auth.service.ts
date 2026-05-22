import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TransferMasterDto } from './dto/transfer-master.dto';
import { comparePassword, hashPassword } from '../../common/utils/password.util';
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

    const requiereJaf =
      usuario.rol === Role.OPERADOR ||
      usuario.rol === Role.CONSULTA ||
      (usuario.rol === Role.ADMINISTRADOR && !usuario.esMaster);

    if (requiereJaf && !usuario.jaf) {
      throw new UnauthorizedException(
        'Usuario sin JAF asignada. Contacte a un administrador.',
      );
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
