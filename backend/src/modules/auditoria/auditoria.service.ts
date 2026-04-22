import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { Prisma } from '@prisma/client';

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

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

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
    const sesion = await this.prisma.sesionAcceso.create({
      data: {
        usuarioId: params.usuarioId,
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
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.sesionAcceso.update({
      where: { id: params.sesionId },
      data: {
        cierreSesion: new Date(),
      },
    });

    await this.registrarAccion({
      usuarioId: params.usuarioId,
      accion: 'LOGOUT',
      entidad: 'AUTH',
      entidadId: params.sesionId,
      descripcion: 'Cierre de sesión',
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  async listarAuditoria(query: QueryAuditoriaDto) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const where = {
      accion: query.accion
        ? {
            contains: query.accion,
            mode: 'insensitive' as const,
          }
        : undefined,
      entidad: query.entidad
        ? {
            contains: query.entidad,
            mode: 'insensitive' as const,
          }
        : undefined,
      usuarioId: query.usuarioId,
    };

    const [total, items] = await Promise.all([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombreCompleto: true,
              email: true,
              rol: true,
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
