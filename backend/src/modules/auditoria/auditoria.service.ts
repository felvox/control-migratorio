import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { MotivoCierreSesion, Prisma, Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface RegistrarAccionParams {
  usuarioId?: string;
  casoId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  descripcion?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const ACCIONES_SEGURIDAD = [
  'LOGIN_FALLIDO',
  'LOGIN_BLOQUEADO_TEMPORAL',
  'LOGIN_IP_NUEVA',
];

@Injectable()
export class AuditoriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async registrarAccion(params: RegistrarAccionParams): Promise<void> {
    await this.prisma.auditoria.create({
      data: {
        usuarioId: params.usuarioId,
        casoId: params.casoId,
        accion: params.accion,
        entidad: params.entidad,
        entidadId: params.entidadId,
        descripcion: params.descripcion,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  }

  async registrarInicioSesion(params: {
    usuarioId: string;
    ip?: string;
    userAgent?: string;
  }): Promise<string> {
    const ahora = new Date();
    const sesion = await this.prisma.sesionAcceso.create({
      data: {
        usuarioId: params.usuarioId,
        inicioSesion: ahora,
        ultimaActividadAt: ahora,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });

    await this.registrarAccion({
      usuarioId: params.usuarioId,
      accion: 'LOGIN',
      entidad: 'AUTH',
      entidadId: sesion.id,
      descripcion: 'Inicio de sesión exitoso',
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return sesion.id;
  }

  async registrarCierreSesion(params: {
    sesionId: string;
    usuarioId: string;
    motivo?: MotivoCierreSesion;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const ahora = new Date();
    await this.prisma.sesionAcceso.update({
      where: { id: params.sesionId },
      data: {
        cierreSesion: ahora,
        motivoCierre: params.motivo ?? MotivoCierreSesion.LOGOUT,
        ultimaActividadAt: ahora,
      },
    });

    await this.registrarAccion({
      usuarioId: params.usuarioId,
      accion: 'LOGOUT',
      entidad: 'AUTH',
      entidadId: params.sesionId,
      descripcion:
        params.motivo === MotivoCierreSesion.INACTIVIDAD
          ? 'Cierre de sesión por inactividad'
          : 'Cierre de sesión',
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  async registrarActividadSesion(params: { sesionId: string; fecha: Date }) {
    await this.prisma.sesionAcceso.update({
      where: { id: params.sesionId },
      data: {
        ultimaActividadAt: params.fecha,
      },
    });
  }

  async listarAuditoria(query: QueryAuditoriaDto) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const acciones = (query.acciones ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const entidades = (query.entidades ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const whereAnd: Prisma.AuditoriaWhereInput[] = [];

    if (query.accion) {
      whereAnd.push({
        accion: {
          contains: query.accion,
          mode: 'insensitive',
        },
      });
    }

    if (query.entidad) {
      whereAnd.push({
        entidad: {
          contains: query.entidad,
          mode: 'insensitive',
        },
      });
    }

    if (acciones.length > 0) {
      whereAnd.push({
        accion: {
          in: acciones,
        },
      });
    }

    if (entidades.length > 0) {
      whereAnd.push({
        entidad: {
          in: entidades,
        },
      });
    }

    if (query.jaf) {
      whereAnd.push({
        OR: [
          {
            caso: {
              jaf: query.jaf,
            },
          },
          {
            usuario: {
              jaf: query.jaf,
            },
          },
        ],
      });
    }

    if (query.usuarioId) {
      whereAnd.push({
        usuarioId: query.usuarioId,
      });
    }

    if (query.rol) {
      whereAnd.push({
        usuario: {
          rol: query.rol,
        },
      });
    }

    if (query.fechaDesde || query.fechaHasta) {
      const fechaHora: Prisma.DateTimeFilter = {};

      if (query.fechaDesde) {
        fechaHora.gte = new Date(query.fechaDesde);
      }

      if (query.fechaHasta) {
        fechaHora.lte = new Date(query.fechaHasta);
      }

      whereAnd.push({ fechaHora });
    }

    const where: Prisma.AuditoriaWhereInput =
      whereAnd.length > 0
        ? {
            AND: whereAnd,
          }
        : {};

    const [total, items] = await Promise.all([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombreCompleto: true,
              rol: true,
            },
          },
          caso: {
            select: {
              id: true,
              personas: {
                select: {
                  tipoPersona: true,
                  nombres: true,
                  apellidos: true,
                  edad: true,
                },
                orderBy: { creadoAt: 'asc' },
              },
            },
          },
        },
        orderBy: { fechaHora: 'desc' },
        skip,
        take: limite,
      }),
    ]);

    return {
      pagina,
      limite,
      total,
      items,
    };
  }

  async listarUsuariosFiltrables(query: Pick<QueryAuditoriaDto, 'jaf' | 'rol'>) {
    const where: Prisma.UsuarioWhereInput = {
      eliminadoAt: null,
      rol: query.rol,
      jaf: query.jaf,
    };

    const usuarios = await this.prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nombreCompleto: true,
        rol: true,
        jaf: true,
        esMaster: true,
      },
      orderBy: [
        { rol: 'asc' },
        { nombreCompleto: 'asc' },
      ],
    });

    if (query.rol !== Role.ADMINISTRADOR) {
      return usuarios.filter((usuario) => !usuario.esMaster);
    }

    return usuarios;
  }

  async listarSesionesActivas(
    query: Pick<QueryAuditoriaDto, 'jaf' | 'rol' | 'usuarioId'>,
  ) {
    await this.cerrarSesionesExpiradasPorInactividad();

    const ventanaActivaMinutos = Math.max(
      1,
      this.configService.get<number>('session.activeNowWindowMinutes', 5) ?? 5,
    );
    const limiteActivo = new Date(Date.now() - ventanaActivaMinutos * 60 * 1000);

    const where: Prisma.SesionAccesoWhereInput = {
      cierreSesion: null,
      usuarioId: query.usuarioId,
      usuario: {
        eliminadoAt: null,
        activo: true,
        jaf: query.jaf,
        rol: query.rol,
      },
    };

    const sesiones = await this.prisma.sesionAcceso.findMany({
      where,
      orderBy: { ultimaActividadAt: 'desc' },
      include: {
        usuario: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
            jaf: true,
          },
        },
      },
      take: 200,
    });

    const items = sesiones.map((sesion) => {
      const estado =
        sesion.ultimaActividadAt >= limiteActivo
          ? 'ACTIVO_AHORA'
          : 'INACTIVO';

      return {
        id: sesion.id,
        inicioSesion: sesion.inicioSesion,
        ultimaActividadAt: sesion.ultimaActividadAt,
        ip: sesion.ip,
        userAgent: sesion.userAgent,
        estado,
        usuario: sesion.usuario,
      };
    });

    return {
      ventanaActivaMinutos,
      totalSesionesAbiertas: items.length,
      totalActivosAhora: items.filter((item) => item.estado === 'ACTIVO_AHORA')
        .length,
      items,
    };
  }

  async listarUsuariosConexion(
    query: Pick<
      QueryAuditoriaDto,
      'jaf' | 'rol' | 'usuarioId' | 'estadoConexion'
    >,
  ) {
    await this.cerrarSesionesExpiradasPorInactividad();

    const ventanaActivaMinutos = Math.max(
      1,
      this.configService.get<number>('session.activeNowWindowMinutes', 5) ?? 5,
    );

    const usuarios = await this.prisma.usuario.findMany({
      where: {
        eliminadoAt: null,
        id: query.usuarioId,
        jaf: query.jaf,
        rol: query.rol,
      },
      select: {
        id: true,
        nombreCompleto: true,
        rol: true,
        jaf: true,
      },
      orderBy: [{ rol: 'asc' }, { nombreCompleto: 'asc' }],
      take: 500,
    });

    if (!usuarios.length) {
      return {
        ventanaActivaMinutos,
        totalUsuarios: 0,
        totalActivos: 0,
        totalDesconectados: 0,
        items: [],
      };
    }

    const sesionesAbiertas = await this.prisma.sesionAcceso.findMany({
      where: {
        cierreSesion: null,
        usuarioId: {
          in: usuarios.map((usuario) => usuario.id),
        },
      },
      select: {
        id: true,
        usuarioId: true,
        inicioSesion: true,
        ultimaActividadAt: true,
      },
      orderBy: { ultimaActividadAt: 'desc' },
      take: 500,
    });

    const sesionPorUsuario = new Map<
      string,
      (typeof sesionesAbiertas)[number]
    >();
    sesionesAbiertas.forEach((sesion) => {
      if (!sesionPorUsuario.has(sesion.usuarioId)) {
        sesionPorUsuario.set(sesion.usuarioId, sesion);
      }
    });

    const itemsCompletos = usuarios.map((usuario) => {
      const sesion = sesionPorUsuario.get(usuario.id);
      const estaConectado = Boolean(sesion);

      return {
        usuario,
        sesionId: sesion?.id ?? null,
        inicioSesion: sesion?.inicioSesion ?? null,
        ultimaActividadAt: sesion?.ultimaActividadAt ?? null,
        estadoConexion: estaConectado ? 'ACTIVO' : 'DESCONECTADO',
      };
    });

    const totalActivos = itemsCompletos.filter(
      (item) => item.estadoConexion === 'ACTIVO',
    ).length;
    const totalDesconectados = itemsCompletos.length - totalActivos;

    const estadoFiltro = query.estadoConexion ?? 'ACTIVOS';
    const items = itemsCompletos.filter((item) => {
      if (estadoFiltro === 'ACTIVOS') {
        return item.estadoConexion === 'ACTIVO';
      }
      return item.estadoConexion === 'DESCONECTADO';
    });

    return {
      ventanaActivaMinutos,
      totalUsuarios: itemsCompletos.length,
      totalActivos,
      totalDesconectados,
      items,
    };
  }

  async obtenerEventosSeguridadPendientes() {
    const totalPendientes = await this.prisma.auditoria.count({
      where: {
        accion: {
          in: ACCIONES_SEGURIDAD,
        },
        seguridadRevisadoAt: null,
      },
    });

    return { totalPendientes };
  }

  async listarEventosSeguridadPendientes(estado: 'PENDIENTES' | 'REVISADOS') {
    const whereSeguridad: Prisma.AuditoriaWhereInput = {
      accion: {
        in: ACCIONES_SEGURIDAD,
      },
      seguridadRevisadoAt:
        estado === 'PENDIENTES'
          ? null
          : {
              not: null,
            },
    };

    return this.prisma.auditoria.findMany({
      where: whereSeguridad,
      include: {
        usuario: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
          },
        },
      },
      orderBy: { fechaHora: 'desc' },
      take: 200,
    });
  }

  async marcarEventosSeguridadRevisados(usuarioId: string) {
    const ahora = new Date();
    const resultado = await this.prisma.auditoria.updateMany({
      where: {
        accion: {
          in: ACCIONES_SEGURIDAD,
        },
        seguridadRevisadoAt: null,
      },
      data: {
        seguridadRevisadoAt: ahora,
        seguridadRevisadoPorId: usuarioId,
      },
    });

    return { totalMarcados: resultado.count };
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

  async actividadReciente(limit = 10) {
    return this.prisma.auditoria.findMany({
      orderBy: { fechaHora: 'desc' },
      take: limit,
      include: {
        usuario: {
          select: {
            nombreCompleto: true,
            rol: true,
          },
        },
      },
    });
  }
}
