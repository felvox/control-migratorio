import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedbackDireccion,
  FeedbackEstado,
  Jaf,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private esAdminOperativo(actor: AuthUser): boolean {
    return actor.role === Role.ADMINISTRADOR && !actor.esMaster;
  }

  private obtenerJafOperativa(actor: AuthUser): Jaf {
    if (!actor.jaf) {
      throw new ForbiddenException(
        'Administrador operativo sin JAF asignada. Contacte al Administrador General.',
      );
    }

    return actor.jaf;
  }

  async crear(
    dto: CreateFeedbackDto,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (actor.role !== Role.ADMINISTRADOR) {
      throw new ForbiddenException('No tiene permisos para enviar feedback.');
    }

    const data = actor.esMaster
      ? {
          asunto: dto.asunto.trim(),
          mensaje: dto.mensaje.trim(),
          prioridad: dto.prioridad,
          direccion: FeedbackDireccion.A_OPERATIVOS,
          jaf: actor.jaf ?? Jaf.TARAPACA,
          jafDestino: dto.jafDestino ?? null,
          usuarioId: actor.id,
        }
      : {
          asunto: dto.asunto.trim(),
          mensaje: dto.mensaje.trim(),
          prioridad: dto.prioridad,
          direccion: FeedbackDireccion.A_MASTER,
          jaf: this.obtenerJafOperativa(actor),
          jafDestino: null,
          usuarioId: actor.id,
        };

    const feedback = await this.prisma.feedback.create({
      data,
      include: {
        usuario: {
          select: {
            id: true,
            nombreCompleto: true,
            run: true,
            jaf: true,
          },
        },
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
      accion: actor.esMaster ? 'ENVIAR_FEEDBACK_OPERATIVO' : 'CREAR_FEEDBACK',
      entidad: 'FEEDBACK',
      entidadId: feedback.id,
      descripcion: actor.esMaster
        ? `Aviso enviado a administradores operativos: ${feedback.asunto}`
        : `Feedback enviado: ${feedback.asunto}`,
      metadata: {
        prioridad: feedback.prioridad,
        jaf: feedback.jaf,
        direccion: feedback.direccion,
        jafDestino: feedback.jafDestino ?? 'TODAS',
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return feedback;
  }

  async listar(query: QueryFeedbackDto, actor: AuthUser) {
    if (actor.role !== Role.ADMINISTRADOR) {
      throw new ForbiddenException('No tiene permisos para consultar feedback.');
    }

    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const whereAnd: Prisma.FeedbackWhereInput[] = [
      {
        estado: query.estado,
        prioridad: query.prioridad,
        direccion: query.direccion,
      },
    ];

    if (actor.esMaster) {
      if (query.jaf) {
        whereAnd.push({
          OR: [{ jaf: query.jaf }, { jafDestino: query.jaf }],
        });
      }
    } else {
      const jafActor = this.obtenerJafOperativa(actor);
      whereAnd.push({
        OR: [
          {
            usuarioId: actor.id,
            direccion: FeedbackDireccion.A_MASTER,
          },
          {
            direccion: FeedbackDireccion.A_OPERATIVOS,
            OR: [{ jafDestino: null }, { jafDestino: jafActor }],
          },
        ],
      });
    }

    const where: Prisma.FeedbackWhereInput = { AND: whereAnd };

    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: [{ estado: 'asc' }, { creadoAt: 'desc' }],
        skip,
        take: limite,
        include: {
          usuario: {
            select: {
              id: true,
              nombreCompleto: true,
              run: true,
              jaf: true,
            },
          },
          revisadoPor: {
            select: {
              id: true,
              nombreCompleto: true,
              run: true,
            },
          },
        },
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      items,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(Math.ceil(total / limite), 1),
    };
  }

  async marcarRevisado(
    feedbackId: string,
    actor: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        estado: true,
        asunto: true,
        direccion: true,
        jafDestino: true,
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback no encontrado.');
    }

    if (feedback.estado === FeedbackEstado.REVISADO) {
      return { message: 'El feedback ya estaba marcado como revisado.' };
    }

    if (actor.esMaster && actor.role === Role.ADMINISTRADOR) {
      if (feedback.direccion !== FeedbackDireccion.A_MASTER) {
        throw new ForbiddenException(
          'Este feedback corresponde a un aviso para administradores operativos.',
        );
      }
    } else if (this.esAdminOperativo(actor)) {
      if (feedback.direccion !== FeedbackDireccion.A_OPERATIVOS) {
        throw new ForbiddenException('No tiene permisos para revisar este feedback.');
      }

      const jafActor = this.obtenerJafOperativa(actor);
      const visibleParaActor =
        feedback.jafDestino === null || feedback.jafDestino === jafActor;
      if (!visibleParaActor) {
        throw new ForbiddenException('No tiene permisos para revisar este feedback.');
      }
    } else {
      throw new ForbiddenException('No tiene permisos para revisar este feedback.');
    }

    await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        estado: FeedbackEstado.REVISADO,
        revisadoAt: new Date(),
        revisadoPorId: actor.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: actor.id,
      accion: 'REVISAR_FEEDBACK',
      entidad: 'FEEDBACK',
      entidadId: feedback.id,
      descripcion: `Feedback revisado: ${feedback.asunto}`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { message: 'Feedback marcado como revisado.' };
  }

  async contarPendientes(actor: AuthUser) {
    if (actor.role !== Role.ADMINISTRADOR) {
      throw new ForbiddenException('No tiene permisos para consultar feedback.');
    }

    if (actor.esMaster) {
      const total = await this.prisma.feedback.count({
        where: {
          estado: FeedbackEstado.PENDIENTE,
          direccion: FeedbackDireccion.A_MASTER,
        },
      });
      return { total };
    }

    const jafActor = this.obtenerJafOperativa(actor);
    const total = await this.prisma.feedback.count({
      where: {
        estado: FeedbackEstado.PENDIENTE,
        direccion: FeedbackDireccion.A_OPERATIVOS,
        OR: [{ jafDestino: null }, { jafDestino: jafActor }],
      },
    });

    return { total };
  }
}
