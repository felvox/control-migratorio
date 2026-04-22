import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { hashPassword } from '../../common/utils/password.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { normalizeRun } from '../../common/utils/run.util';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async crear(
    dto: CreateUsuarioDto,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const runNormalizado = normalizeRun(dto.run);
    const emailNormalizado = dto.email ? dto.email.toLowerCase() : null;

    const existente = await this.prisma.usuario.findFirst({
      where: {
        OR: emailNormalizado
          ? [{ run: runNormalizado }, { email: emailNormalizado }]
          : [{ run: runNormalizado }],
      },
      select: { id: true },
    });

    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese RUN o email');
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        run: runNormalizado,
        email: emailNormalizado,
        nombreCompleto: dto.nombreCompleto,
        rol: dto.rol,
        passwordHash: await hashPassword(dto.password),
      },
      select: {
        id: true,
        run: true,
        email: true,
        nombreCompleto: true,
        rol: true,
        activo: true,
        creadoAt: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actorId,
      accion: 'CREAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: usuario.id,
      descripcion: `Usuario RUN ${usuario.run} creado`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return usuario;
  }

  async listar(query: QueryUsuariosDto) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const where = {
      eliminadoAt: null,
      rol: query.rol,
      activo: query.activo,
      OR: query.busqueda
        ? [
            {
              nombreCompleto: {
                contains: query.busqueda,
                mode: 'insensitive' as const,
              },
            },
            {
              run: {
                contains: query.busqueda,
                mode: 'insensitive' as const,
              },
            },
            {
              email: {
                contains: query.busqueda,
                mode: 'insensitive' as const,
              },
            },
          ]
        : undefined,
    };

    const [total, items] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        orderBy: { creadoAt: 'desc' },
        skip,
        take: limite,
        select: {
          id: true,
          run: true,
          email: true,
          nombreCompleto: true,
          rol: true,
          activo: true,
          creadoAt: true,
          actualizadoAt: true,
          sesiones: {
            take: 1,
            orderBy: { inicioSesion: 'desc' },
            select: {
              inicioSesion: true,
            },
          },
        },
      }),
    ]);

    const usuarios = items.map((item) => ({
      ...item,
      ultimoAcceso: item.sesiones[0]?.inicioSesion ?? null,
      sesiones: undefined,
    }));

    return {
      pagina,
      limite,
      total,
      items: usuarios,
    };
  }

  async obtenerPorId(id: string) {
    const user = await this.prisma.usuario.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        run: true,
        email: true,
        nombreCompleto: true,
        rol: true,
        activo: true,
        creadoAt: true,
        actualizadoAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async actualizar(
    id: string,
    dto: UpdateUsuarioDto,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.obtenerPorId(id);

    const data: Record<string, unknown> = {
      ...dto,
      run: dto.run ? normalizeRun(dto.run) : undefined,
      email: dto.email ? dto.email.toLowerCase() : undefined,
    };

    try {
      const user = await this.prisma.usuario.update({
        where: { id },
        data,
        select: {
          id: true,
          run: true,
          email: true,
          nombreCompleto: true,
          rol: true,
          activo: true,
          actualizadoAt: true,
        },
      });

      await this.auditoriaService.registrarAccion({
        usuarioId: actorId,
        accion: 'EDITAR_USUARIO',
        entidad: 'USUARIO',
        entidadId: id,
        descripcion: `Usuario ${id} actualizado`,
        metadata: dto as unknown as Record<string, unknown>,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return user;
    } catch (_error) {
      throw new ConflictException('No fue posible actualizar el usuario');
    }
  }

  async desactivar(
    id: string,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (id === actorId) {
      throw new BadRequestException('No puede desactivarse a sí mismo');
    }

    await this.obtenerPorId(id);

    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
      select: {
        id: true,
        run: true,
        activo: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actorId,
      accion: 'DESACTIVAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      descripcion: `Usuario RUN ${usuario.run} desactivado`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return usuario;
  }

  async resetearPassword(
    id: string,
    dto: ResetPasswordDto,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.obtenerPorId(id);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(dto.nuevaPassword),
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actorId,
      accion: 'RESET_PASSWORD_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      descripcion: `Password reseteada para usuario ${id}`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      id,
      message: 'Contraseña actualizada correctamente',
    };
  }

  async eliminarLogico(
    id: string,
    actorId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (id === actorId) {
      throw new BadRequestException('No puede eliminarse a sí mismo');
    }

    await this.obtenerPorId(id);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoAt: new Date(),
        activo: false,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actorId,
      accion: 'ELIMINAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      descripcion: `Usuario ${id} eliminado lógicamente`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      id,
      message: 'Usuario eliminado lógicamente',
    };
  }
}
