import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCaso,
  InstitucionDerivacion,
  Prisma,
  Role,
  TipoPersona,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { QueryCasosDto } from './dto/query-casos.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';
import { CambiarEstadoCasoDto } from './dto/cambiar-estado-caso.dto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class CasosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private resolverFlujo(existenMenores: boolean) {
    if (existenMenores) {
      return {
        estado: EstadoCaso.DERIVADO_CARABINEROS,
        institucionDerivacion: InstitucionDerivacion.CARABINEROS,
      };
    }

    return {
      estado: EstadoCaso.DERIVADO_PDI,
      institucionDerivacion: InstitucionDerivacion.PDI,
    };
  }

  private async generarCodigoCaso(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const base = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(1000 + Math.random() * 9000);
      const codigo = `CM-${base}-${random}`;
      const existe = await this.prisma.caso.findUnique({
        where: { codigo },
        select: { id: true },
      });

      if (!existe) {
        return codigo;
      }
    }

    return `CM-${Date.now()}`;
  }

  private validarAcceso(caso: { creadoPorId: string }, user: AuthUser) {
    if (user.role === Role.OPERADOR && caso.creadoPorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para acceder a este caso');
    }
  }

  async crear(
    dto: CreateCasoDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const existenMenoresDetectados =
      dto.existenMenores ||
      dto.personas.some(
        (persona) =>
          persona.tipoPersona === TipoPersona.MENOR || persona.edad < 18,
      );

    const vieneAcompanadoDetectado = dto.vieneAcompanado || dto.personas.length > 1;
    const flujo = this.resolverFlujo(existenMenoresDetectados);
    const codigo = await this.generarCodigoCaso();

    const caso = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.caso.create({
        data: {
          codigo,
          tipoControl: dto.tipoControl,
          fechaHoraProcedimiento: new Date(dto.fechaHoraProcedimiento),
          lugar: dto.lugar,
          coordenadas: dto.coordenadas,
          fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : undefined,
          documentado: dto.documentado,
          estadoSalud: dto.estadoSalud,
          observaciones: dto.observaciones,
          vieneAcompanado: vieneAcompanadoDetectado,
          existenMenores: existenMenoresDetectados,
          estado: flujo.estado,
          institucionDerivacion: flujo.institucionDerivacion,
          creadoPorId: user.id,
          personas: {
            create: dto.personas.map((persona) => ({
              ...persona,
              fechaNacimiento: new Date(persona.fechaNacimiento),
              creadoPorId: user.id,
            })),
          },
        },
        include: {
          personas: true,
          creadoPor: {
            select: {
              id: true,
              nombreCompleto: true,
              rol: true,
            },
          },
        },
      });

      return creado;
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: caso.id,
      accion: 'CREAR_CASO',
      entidad: 'CASO',
      entidadId: caso.id,
      descripcion: `Caso ${caso.codigo} creado`,
      metadata: {
        estado: caso.estado,
        institucionDerivacion: caso.institucionDerivacion,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return caso;
  }

  async listar(query: QueryCasosDto, user: AuthUser) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const where: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      estado: query.estado,
      tipoControl: query.tipoControl,
      creadoPorId:
        user.role === Role.OPERADOR
          ? user.id
          : query.operadorId
            ? query.operadorId
            : undefined,
      lugar: query.ubicacion
        ? {
            contains: query.ubicacion,
            mode: 'insensitive',
          }
        : undefined,
      fechaHoraProcedimiento:
        query.fechaDesde || query.fechaHasta
          ? {
              gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
              lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
            }
          : undefined,
      personas:
        query.nombre || query.documento || query.nacionalidad
          ? {
              some: {
                nombres: query.nombre
                  ? {
                      contains: query.nombre,
                      mode: 'insensitive',
                    }
                  : undefined,
                numeroDocumento: query.documento
                  ? {
                      contains: query.documento,
                      mode: 'insensitive',
                    }
                  : undefined,
                nacionalidad: query.nacionalidad
                  ? {
                      contains: query.nacionalidad,
                      mode: 'insensitive',
                    }
                  : undefined,
              },
            }
          : undefined,
    };

    const [total, items] = await Promise.all([
      this.prisma.caso.count({ where }),
      this.prisma.caso.findMany({
        where,
        skip,
        take: limite,
        orderBy: { creadoAt: 'desc' },
        include: {
          creadoPor: {
            select: {
              id: true,
              nombreCompleto: true,
              rol: true,
            },
          },
          personas: {
            select: {
              id: true,
              tipoPersona: true,
              nombres: true,
              apellidos: true,
              numeroDocumento: true,
            },
          },
        },
      }),
    ]);

    return {
      pagina,
      limite,
      total,
      items,
    };
  }

  async obtenerPorId(id: string, user: AuthUser) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      include: {
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
          },
        },
        actualizadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
          },
        },
        personas: true,
        evidencias: {
          orderBy: { creadoAt: 'desc' },
        },
        documentos: {
          orderBy: { creadoAt: 'desc' },
        },
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    this.validarAcceso(caso, user);

    return caso;
  }

  async actualizar(
    id: string,
    dto: UpdateCasoDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
        existenMenores: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    this.validarAcceso(caso, user);

    const existenMenoresDetectados =
      dto.existenMenores ??
      (dto.personas
        ? dto.personas.some(
            (persona) =>
              persona.tipoPersona === TipoPersona.MENOR || persona.edad < 18,
          )
        : caso.existenMenores);

    const flujo = this.resolverFlujo(existenMenoresDetectados);

    const dataBase: Prisma.CasoUpdateInput = {
      tipoControl: dto.tipoControl,
      fechaHoraProcedimiento: dto.fechaHoraProcedimiento
        ? new Date(dto.fechaHoraProcedimiento)
        : undefined,
      lugar: dto.lugar,
      coordenadas: dto.coordenadas,
      fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : undefined,
      documentado: dto.documentado,
      estadoSalud: dto.estadoSalud,
      observaciones: dto.observaciones,
      vieneAcompanado: dto.vieneAcompanado,
      existenMenores: dto.existenMenores ?? existenMenoresDetectados,
      estado: dto.estado ?? flujo.estado,
      institucionDerivacion:
        dto.institucionDerivacion ?? flujo.institucionDerivacion,
      actualizadoPor: {
        connect: {
          id: user.id,
        },
      },
    };

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const casoActualizado = await tx.caso.update({
        where: { id },
        data: dataBase,
      });

      if (dto.personas) {
        await tx.persona.deleteMany({
          where: { casoId: id },
        });

        await tx.persona.createMany({
          data: dto.personas.map((persona) => ({
            ...persona,
            casoId: id,
            fechaNacimiento: new Date(persona.fechaNacimiento),
            creadoPorId: user.id,
          })),
        });
      }

      return casoActualizado;
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'EDITAR_CASO',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} actualizado`,
      metadata: dto as unknown as Record<string, unknown>,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(actualizado.id, user);
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoCasoDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    this.validarAcceso(caso, user);

    const actualizado = await this.prisma.caso.update({
      where: { id },
      data: {
        estado: dto.estado,
        institucionDerivacion: dto.institucionDerivacion,
        actualizadoPorId: user.id,
      },
      select: {
        id: true,
        codigo: true,
        estado: true,
        institucionDerivacion: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'CAMBIAR_ESTADO_CASO',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} cambio a estado ${dto.estado}`,
      metadata: dto as unknown as Record<string, unknown>,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return actualizado;
  }

  async ultimosCasos(limit = 10) {
    return this.prisma.caso.findMany({
      where: {
        eliminadoAt: null,
      },
      orderBy: {
        creadoAt: 'desc',
      },
      take: limit,
      include: {
        creadoPor: {
          select: {
            nombreCompleto: true,
          },
        },
        personas: {
          take: 1,
          select: {
            nombres: true,
            apellidos: true,
            numeroDocumento: true,
          },
        },
      },
    });
  }
}
