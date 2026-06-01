import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoCaso,
  InstitucionDerivacion,
  Jaf,
  Prisma,
  Role,
  TipoPersona,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { QueryCasosDto } from './dto/query-casos.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';
import { CambiarEstadoCasoDto } from './dto/cambiar-estado-caso.dto';
import { AddObservacionInstitucionalDto } from './dto/add-observacion-institucional.dto';
import {
  CerrarPdiDto,
  PdiResultado,
} from './dto/cerrar-pdi.dto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  resolverJafParaActualizacion,
  resolverJafParaCreacion,
  tieneRestriccionPorJaf,
  validarAccesoCaso,
  validarGestionSoloCreador,
  validarGestionMasterSobreCaso,
  validarEtapaGestionInstitucional,
  validarRolFlujo,
} from './casos-acceso-policy.utils';
import {
  agregarLineaObservacion,
  construirLineaObservacionInstitucional,
  construirLineaResolucionPdi,
  resolverFlujo,
  resolverResultadoPdi,
} from './casos-flujo.utils';
import { resolverFiltroDerivacionPorRol } from './casos-listado-policy.utils';

@Injectable()
export class CasosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

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


  private async obtenerCasoParaFlujo(id: string) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        estado: true,
        institucionDerivacion: true,
        creadoPorId: true,
        jaf: true,
        existenMenores: true,
        observaciones: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    return caso;
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
    const flujo = resolverFlujo(existenMenoresDetectados);
    const jafCaso = resolverJafParaCreacion(dto.jaf, user);
    const codigo = await this.generarCodigoCaso();

    const caso = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.caso.create({
        data: {
          codigo,
          jaf: jafCaso,
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

    if (tieneRestriccionPorJaf(user) && !user.jaf) {
      throw new ForbiddenException(
        'Usuario sin JAF asignada. Contacte a un administrador.',
      );
    }

    const filtroDerivacionPorRol = resolverFiltroDerivacionPorRol(user, query);

    const where: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      estado: query.estado,
      tipoControl: query.tipoControl,
      jaf:
        tieneRestriccionPorJaf(user)
          ? user.jaf ?? undefined
          : query.jaf,
      creadoPorId: query.operadorId ? query.operadorId : undefined,
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
      existenMenores:
        typeof query.existenMenores === 'boolean'
          ? query.existenMenores
          : undefined,
      institucionDerivacion:
        user.role !== Role.CARABINEROS &&
        user.role !== Role.PDI &&
        query.institucionDerivacion
          ? query.institucionDerivacion
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
      ...filtroDerivacionPorRol,
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

    validarAccesoCaso(caso, user);

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
        jaf: true,
        estado: true,
        institucionDerivacion: true,
        existenMenores: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);
    validarGestionSoloCreador(caso, user, 'editar este caso');

    if (caso.estado !== EstadoCaso.PENDIENTE) {
      throw new ForbiddenException(
        'Solo se puede editar un caso pendiente. Los casos derivados quedan solo para consulta.',
      );
    }

    const existenMenoresDetectados =
      dto.existenMenores ??
      (dto.personas
        ? dto.personas.some(
            (persona) =>
              persona.tipoPersona === TipoPersona.MENOR || persona.edad < 18,
          )
        : caso.existenMenores);

    const flujo = resolverFlujo(existenMenoresDetectados);
    const jafCaso = resolverJafParaActualizacion(dto.jaf, user, caso.jaf);

    const dataBase: Prisma.CasoUpdateInput = {
      jaf: jafCaso,
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
      estado: dto.estado ?? caso.estado,
      institucionDerivacion:
        dto.institucionDerivacion ??
        (caso.estado === EstadoCaso.PENDIENTE
          ? flujo.institucionDerivacion
          : caso.institucionDerivacion),
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
    if (user.role !== Role.ADMINISTRADOR || !user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede cambiar estado manualmente',
      );
    }

    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
        jaf: true,
        institucionDerivacion: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    validarAccesoCaso(caso, user);

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

  async agregarObservacionInstitucional(
    id: string,
    dto: AddObservacionInstitucionalDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.CARABINEROS, Role.PDI]);

    const caso = await this.prisma.caso.findFirst({
      where: {
        id,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
        jaf: true,
        estado: true,
        institucionDerivacion: true,
        existenMenores: true,
        observaciones: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);
    validarEtapaGestionInstitucional(caso, user);

    const observacion = dto.observacion.trim();
    const fechaMarca = new Date().toISOString();
    const linea = construirLineaObservacionInstitucional(
      user.role,
      observacion,
      fechaMarca,
    );
    const observacionesActualizadas = agregarLineaObservacion(
      caso.observaciones,
      linea,
    );

    const actualizado = await this.prisma.caso.update({
      where: { id: caso.id },
      data: {
        observaciones: observacionesActualizadas,
        actualizadoPorId: user.id,
      },
      select: {
        id: true,
        observaciones: true,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: caso.id,
      accion: 'AGREGAR_OBSERVACION_INSTITUCIONAL',
      entidad: 'CASO',
      entidadId: caso.id,
      descripcion: `Observación institucional agregada al caso ${caso.codigo}`,
      metadata: {
        rol: user.role,
        observacion,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return actualizado;
  }

  async recepcionarEnCarabineros(
    id: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.CARABINEROS]);

    const caso = await this.obtenerCasoParaFlujo(id);
    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);
    validarGestionSoloCreador(caso, user, `enviar este caso a ${caso.institucionDerivacion}`);

    if (caso.estado !== EstadoCaso.DERIVADO_CARABINEROS) {
      throw new ForbiddenException(
        'Solo se puede recepcionar en Carabineros un caso derivado a Carabineros',
      );
    }

    await this.prisma.caso.update({
      where: { id },
      data: {
        actualizadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'RECEPCIONAR_CASO_CARABINEROS',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} recepcionado por Carabineros`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(id, user);
  }

  async enviarDerivacionPendiente(
    id: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.ADMINISTRADOR, Role.OPERADOR]);

    const caso = await this.obtenerCasoParaFlujo(id);
    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);

    if (caso.estado !== EstadoCaso.PENDIENTE) {
      throw new ForbiddenException(
        'Solo se puede enviar un caso que está pendiente de derivación',
      );
    }

    if (
      caso.institucionDerivacion !== InstitucionDerivacion.CARABINEROS &&
      caso.institucionDerivacion !== InstitucionDerivacion.PDI
    ) {
      throw new ForbiddenException(
        'El caso no tiene una institución de derivación definida',
      );
    }

    const estadoNuevo =
      caso.institucionDerivacion === InstitucionDerivacion.CARABINEROS
        ? EstadoCaso.DERIVADO_CARABINEROS
        : EstadoCaso.DERIVADO_PDI;

    await this.prisma.caso.update({
      where: { id },
      data: {
        estado: estadoNuevo,
        actualizadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'ENVIAR_CASO_DERIVACION',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} enviado a ${caso.institucionDerivacion}`,
      metadata: {
        estadoAnterior: caso.estado,
        estadoNuevo,
        institucionDerivacion: caso.institucionDerivacion,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(id, user);
  }

  async derivarDesdeCarabinerosAPdi(
    id: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.CARABINEROS]);

    const caso = await this.obtenerCasoParaFlujo(id);
    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);

    if (caso.estado !== EstadoCaso.DERIVADO_CARABINEROS) {
      throw new ForbiddenException(
        'Solo se puede derivar a PDI un caso derivado a Carabineros',
      );
    }

    await this.prisma.caso.update({
      where: { id },
      data: {
        estado: EstadoCaso.DERIVADO_PDI,
        institucionDerivacion: InstitucionDerivacion.PDI,
        actualizadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'DERIVAR_CASO_A_PDI',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} derivado a PDI por Carabineros`,
      metadata: {
        estadoAnterior: caso.estado,
        estadoNuevo: EstadoCaso.DERIVADO_PDI,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(id, user);
  }

  async recepcionarEnPdi(
    id: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.PDI]);

    const caso = await this.obtenerCasoParaFlujo(id);
    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);

    if (caso.estado !== EstadoCaso.DERIVADO_PDI) {
      throw new ForbiddenException(
        'Solo se puede recepcionar en PDI un caso derivado a PDI',
      );
    }

    await this.prisma.caso.update({
      where: { id },
      data: {
        actualizadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'RECEPCIONAR_CASO_PDI',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} recepcionado por PDI`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(id, user);
  }

  async cerrarEnPdi(
    id: string,
    dto: CerrarPdiDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    validarRolFlujo(user, [Role.PDI]);

    const caso = await this.obtenerCasoParaFlujo(id);
    validarAccesoCaso(caso, user);
    validarGestionMasterSobreCaso(caso, user);

    if (caso.estado !== EstadoCaso.DERIVADO_PDI) {
      throw new ForbiddenException(
        'Solo se puede cerrar en PDI un caso derivado a PDI',
      );
    }

    const resultadoPdi = resolverResultadoPdi(dto);
    const observaciones = dto.observaciones?.trim() || null;
    const lineaResolucion = construirLineaObservacionInstitucional(
      Role.PDI,
      construirLineaResolucionPdi(dto, resultadoPdi),
      new Date().toISOString(),
    );
    const observacionesActualizadas = agregarLineaObservacion(
      caso.observaciones,
      lineaResolucion,
    );

    await this.prisma.caso.update({
      where: { id },
      data: {
        estado: EstadoCaso.CERRADO,
        pdiOrdenJudicialVigente: dto.ordenJudicialVigente,
        pdiSituacionMigratoria: dto.ordenJudicialVigente
          ? null
          : dto.situacionMigratoria ?? null,
        pdiReconducible:
          !dto.ordenJudicialVigente && dto.situacionMigratoria === 'INGRESO_PNH'
            ? dto.reconducible ?? null
            : null,
        pdiResultado: resultadoPdi,
        pdiObservacionesCierre: observaciones,
        observaciones: observacionesActualizadas,
        actualizadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: id,
      accion: 'CERRAR_CASO_PDI',
      entidad: 'CASO',
      entidadId: id,
      descripcion: `Caso ${caso.codigo} cerrado por PDI`,
      metadata: {
        estadoAnterior: caso.estado,
        estadoNuevo: EstadoCaso.CERRADO,
        ordenJudicialVigente: dto.ordenJudicialVigente,
        situacionMigratoria: dto.situacionMigratoria,
        reconducible: dto.reconducible,
        resultadoPdi,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return this.obtenerPorId(id, user);
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
