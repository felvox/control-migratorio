import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Jaf, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { hashPassword } from '../../common/utils/password.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { isRunChilenoValido, normalizeRun } from '../../common/utils/run.util';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Injectable()
export class UsuariosService {
  private readonly rolesConJaf = new Set<Role>([
    Role.ADMINISTRADOR,
    Role.OPERADOR,
    Role.CONSULTA,
  ]);
  private readonly rolesGestionablesPorOperativo = new Set<Role>([
    Role.OPERADOR,
    Role.CONSULTA,
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private esAdministradorOperativo(actor: AuthUser): boolean {
    return actor.role === Role.ADMINISTRADOR && !actor.esMaster;
  }

  private obtenerJafActor(actor: AuthUser): Jaf {
    if (!actor.jaf) {
      throw new ForbiddenException(
        'Administrador operativo sin JAF asignada. Contacte al Administrador Master.',
      );
    }

    return actor.jaf;
  }

  private validarRolGestionable(actor: AuthUser, rol: Role) {
    if (!this.esAdministradorOperativo(actor)) {
      return;
    }

    if (!this.rolesGestionablesPorOperativo.has(rol)) {
      if (rol === Role.AUDITOR) {
        throw new ForbiddenException(
          'Solo el Administrador Master puede crear o gestionar usuarios Auditor.',
        );
      }

      throw new ForbiddenException(
        'El Administrador Operativo solo puede gestionar usuarios Operador o Consulta.',
      );
    }
  }

  private validarAccesoUsuarioObjetivo(
    actor: AuthUser,
    usuario: { id: string; rol: Role; jaf: Jaf | null },
  ) {
    this.validarRolGestionable(actor, usuario.rol);

    if (!this.esAdministradorOperativo(actor)) {
      return;
    }

    const jafActor = this.obtenerJafActor(actor);
    if (usuario.jaf !== jafActor) {
      throw new ForbiddenException(
        'El Administrador Operativo solo puede gestionar usuarios de su JAF.',
      );
    }
  }

  private resolverJafPorRol(
    rol: Role,
    jaf: Jaf | null | undefined,
    actor: AuthUser,
  ): Jaf | null {
    if (this.rolesConJaf.has(rol)) {
      if (this.esAdministradorOperativo(actor)) {
        return this.obtenerJafActor(actor);
      }

      if (!jaf) {
        throw new BadRequestException(
          'Debe asignar una JAF para usuarios Administrador Operativo, Operador o Consulta',
        );
      }

      return jaf;
    }

    return null;
  }

  async crear(
    dto: CreateUsuarioDto,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (!isRunChilenoValido(dto.run)) {
      throw new BadRequestException('RUN chileno inválido');
    }

    const runNormalizado = normalizeRun(dto.run);
    const grado = dto.grado.trim();
    const nombre = dto.nombre.trim();
    const apellidos = dto.apellidos.trim();

    if (!grado || !nombre || !apellidos) {
      throw new BadRequestException(
        'Grado, nombre y apellidos son obligatorios',
      );
    }

    this.validarRolGestionable(actor, dto.rol);

    const nombreCompleto = [grado, nombre, apellidos].join(' ');
    const jaf = this.resolverJafPorRol(dto.rol, dto.jaf, actor);
    const passwordHash = await hashPassword(dto.password);

    const existente = await this.prisma.usuario.findUnique({
      where: {
        run: runNormalizado,
      },
      select: {
        id: true,
        eliminadoAt: true,
      },
    });

    if (existente && !existente.eliminadoAt) {
      throw new ConflictException('Ya existe un usuario con ese RUN');
    }

    if (existente && existente.eliminadoAt) {
      const usuarioReactivado = await this.prisma.usuario.update({
        where: {
          id: existente.id,
        },
        data: {
          run: runNormalizado,
          nombreCompleto,
          rol: dto.rol,
          jaf,
          esMaster: false,
          activo: true,
          eliminadoAt: null,
          passwordHash,
        },
        select: {
          id: true,
          run: true,
          nombreCompleto: true,
          rol: true,
          jaf: true,
          activo: true,
          creadoAt: true,
        },
      });

      await this.auditoriaService.registrarAccion({
        usuarioId: actor.id,
        accion: 'REACTIVAR_USUARIO',
        entidad: 'USUARIO',
        entidadId: usuarioReactivado.id,
        descripcion: `Usuario RUN ${usuarioReactivado.run} reactivado`,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return usuarioReactivado;
    }

    const usuarioCreado = await this.prisma.usuario.create({
      data: {
        run: runNormalizado,
        nombreCompleto,
        rol: dto.rol,
        jaf,
        passwordHash,
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
        rol: true,
        jaf: true,
        activo: true,
        creadoAt: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
      accion: 'CREAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: usuarioCreado.id,
      descripcion: `Usuario RUN ${usuarioCreado.run} creado`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return usuarioCreado;
  }

  async listar(query: QueryUsuariosDto, actor: AuthUser) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const esOperativo = this.esAdministradorOperativo(actor);
    if (esOperativo && query.rol && !this.rolesGestionablesPorOperativo.has(query.rol)) {
      throw new ForbiddenException(
        'El Administrador Operativo solo puede listar usuarios Operador o Consulta.',
      );
    }

    const where: Prisma.UsuarioWhereInput = {
      eliminadoAt: null,
      esMaster: false,
      rol: esOperativo
        ? query.rol ?? { in: [Role.OPERADOR, Role.CONSULTA] }
        : query.rol,
      jaf: esOperativo ? this.obtenerJafActor(actor) : query.jaf,
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
          nombreCompleto: true,
          rol: true,
          jaf: true,
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

  async obtenerPorId(id: string, actor: AuthUser) {
    const user = await this.prisma.usuario.findFirst({
      where: {
        id,
        eliminadoAt: null,
        esMaster: false,
      },
      select: {
        id: true,
        run: true,
        nombreCompleto: true,
        rol: true,
        jaf: true,
        activo: true,
        creadoAt: true,
        actualizadoAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.validarAccesoUsuarioObjetivo(actor, user);

    return user;
  }

  async actualizar(
    id: string,
    dto: UpdateUsuarioDto,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const usuarioActual = await this.prisma.usuario.findFirst({
      where: {
        id,
        eliminadoAt: null,
        esMaster: false,
      },
      select: {
        id: true,
        rol: true,
        jaf: true,
      },
    });

    if (!usuarioActual) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.validarAccesoUsuarioObjetivo(actor, usuarioActual);

    if (dto.run && !isRunChilenoValido(dto.run)) {
      throw new BadRequestException('RUN chileno inválido');
    }

    const rolObjetivo = dto.rol ?? usuarioActual.rol;
    this.validarRolGestionable(actor, rolObjetivo);

    const jafObjetivo = this.resolverJafPorRol(
      rolObjetivo,
      dto.jaf ?? usuarioActual.jaf,
      actor,
    );

    const data: Record<string, unknown> = {
      ...dto,
      run: dto.run ? normalizeRun(dto.run) : undefined,
      jaf: jafObjetivo,
    };

    try {
      const user = await this.prisma.usuario.update({
        where: { id },
        data,
        select: {
          id: true,
          run: true,
          nombreCompleto: true,
          rol: true,
          jaf: true,
          activo: true,
          actualizadoAt: true,
        },
      });

      await this.auditoriaService.registrarAccion({
        usuarioId: actor.id,
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
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (id === actor.id) {
      throw new BadRequestException('No puede desactivarse a sí mismo');
    }

    await this.obtenerPorId(id, actor);

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
      usuarioId: actor.id,
      accion: 'DESACTIVAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      descripcion: `Usuario RUN ${usuario.run} desactivado`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return usuario;
  }

  async activar(
    id: string,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.obtenerPorId(id, actor);

    const usuarioActual = await this.prisma.usuario.findFirst({
      where: {
        id,
        eliminadoAt: null,
        esMaster: false,
      },
      select: {
        id: true,
        run: true,
        activo: true,
      },
    });

    if (!usuarioActual) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (usuarioActual.activo) {
      throw new BadRequestException('El usuario seleccionado ya está activo');
    }

    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { activo: true },
      select: {
        id: true,
        run: true,
        activo: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
      accion: 'ACTIVAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      descripcion: `Usuario RUN ${usuario.run} activado`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return usuario;
  }

  async resetearPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.obtenerPorId(id, actor);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(dto.nuevaPassword),
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
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
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (id === actor.id) {
      throw new BadRequestException('No puede eliminarse a sí mismo');
    }

    await this.obtenerPorId(id, actor);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoAt: new Date(),
        activo: false,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
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
