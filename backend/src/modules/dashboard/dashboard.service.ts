import { Injectable } from '@nestjs/common';
import {
  EstadoCaso,
  InstitucionDerivacion,
  Prisma,
  TipoControl,
  TipoPersona,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private formatearEtiquetaDia(fechaIso: string): string {
    const [year, month, day] = fechaIso.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }

  private resolverFechaBase(fecha?: string): Date {
    if (!fecha) {
      return new Date();
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (!match) {
      return new Date();
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }

    return parsed;
  }

  private inicioDia(fecha: Date): Date {
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  private finDia(fecha: Date): Date {
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);
    return fin;
  }

  private fechaClaveLocal(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async resumenAdministrador(fecha?: string) {
    const fechaBase = this.resolverFechaBase(fecha);
    const inicioDia = this.inicioDia(fechaBase);
    const finDia = this.finDia(fechaBase);

    const inicioSemana = new Date(inicioDia);
    const day = inicioSemana.getDay();
    const diff = day === 0 ? 6 : day - 1;
    inicioSemana.setDate(inicioSemana.getDate() - diff);
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date(
      fechaBase.getFullYear(),
      fechaBase.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const inicioTendencia = new Date(inicioDia);
    inicioTendencia.setDate(inicioTendencia.getDate() - 6);

    const whereHastaFecha: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      fechaHoraProcedimiento: {
        lte: finDia,
      },
    };

    const whereDia: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      fechaHoraProcedimiento: {
        gte: inicioDia,
        lte: finDia,
      },
    };

    const whereSemana: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      fechaHoraProcedimiento: {
        gte: inicioSemana,
        lte: finDia,
      },
    };

    const whereMes: Prisma.CasoWhereInput = {
      eliminadoAt: null,
      fechaHoraProcedimiento: {
        gte: inicioMes,
        lte: finDia,
      },
    };

    const [
      totalDia,
      totalSemana,
      totalMes,
      casosPorEstado,
      actividadReciente,
      accesosRecientes,
      ultimosCasos,
      casosParaTendencia,
      casosPorTipoControl,
      casosPorDerivacion,
      casosPorDocumentado,
      casosPorMenores,
      estadoPorDocumentado,
      topUbicaciones,
      totalCasosConLesiones,
      totalCasosPendientesFirma,
      totalCasosCerrados,
      totalCasosSinCierre,
      totalCasosConMenorPendiente,
      topNacionalidades,
      totalPersonas,
      totalPersonasMenores,
    ] =
      await Promise.all([
        this.prisma.caso.count({
          where: whereDia,
        }),
        this.prisma.caso.count({
          where: whereSemana,
        }),
        this.prisma.caso.count({
          where: whereMes,
        }),
        this.prisma.caso.groupBy({
          by: ['estado'],
          where: whereHastaFecha,
          _count: {
            estado: true,
          },
        }),
        this.auditoriaService.actividadReciente(12),
        this.prisma.sesionAcceso.findMany({
          orderBy: {
            inicioSesion: 'desc',
          },
          take: 10,
          include: {
            usuario: {
              select: {
                id: true,
                nombreCompleto: true,
                rol: true,
              },
            },
          },
        }),
        this.prisma.caso.findMany({
          where: whereHastaFecha,
          orderBy: {
            fechaHoraProcedimiento: 'desc',
          },
          take: 30,
          include: {
            creadoPor: {
              select: {
                nombreCompleto: true,
              },
            },
            personas: {
              select: {
                tipoPersona: true,
                nombres: true,
                apellidos: true,
                numeroDocumento: true,
                nacionalidad: true,
                edad: true,
              },
            },
          },
        }),
        this.prisma.caso.findMany({
          where: {
            eliminadoAt: null,
            fechaHoraProcedimiento: {
              gte: inicioTendencia,
              lte: finDia,
            },
          },
          select: {
            fechaHoraProcedimiento: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['tipoControl'],
          where: whereHastaFecha,
          _count: {
            tipoControl: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['institucionDerivacion'],
          where: whereHastaFecha,
          _count: {
            institucionDerivacion: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['documentado'],
          where: whereHastaFecha,
          _count: {
            documentado: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['existenMenores'],
          where: whereHastaFecha,
          _count: {
            existenMenores: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['estado', 'documentado'],
          where: whereHastaFecha,
          _count: {
            estado: true,
          },
        }),
        this.prisma.caso.groupBy({
          by: ['lugar'],
          where: whereHastaFecha,
          _count: {
            lugar: true,
          },
          orderBy: {
            _count: {
              lugar: 'desc',
            },
          },
          take: 6,
        }),
        this.prisma.caso.count({
          where: {
            ...whereHastaFecha,
            OR: [
              {
                estadoSalud: {
                  contains: 'lesion',
                  mode: 'insensitive',
                },
              },
              {
                estadoSalud: {
                  contains: 'lesión',
                  mode: 'insensitive',
                },
              },
            ],
          },
        }),
        this.prisma.caso.count({
          where: {
            ...whereHastaFecha,
            estado: EstadoCaso.PENDIENTE,
          },
        }),
        this.prisma.caso.count({
          where: {
            ...whereHastaFecha,
            estado: EstadoCaso.CERRADO,
          },
        }),
        this.prisma.caso.count({
          where: {
            ...whereHastaFecha,
            estado: {
              in: [
                EstadoCaso.PENDIENTE,
                EstadoCaso.DERIVADO_CARABINEROS,
                EstadoCaso.DERIVADO_PDI,
              ],
            },
          },
        }),
        this.prisma.caso.count({
          where: {
            ...whereHastaFecha,
            existenMenores: true,
            estado: EstadoCaso.PENDIENTE,
          },
        }),
        this.prisma.persona.groupBy({
          by: ['nacionalidad'],
          where: {
            caso: {
              ...whereHastaFecha,
            },
          },
          _count: {
            nacionalidad: true,
          },
          orderBy: {
            _count: {
              nacionalidad: 'desc',
            },
          },
          take: 4,
        }),
        this.prisma.persona.count({
          where: {
            caso: {
              ...whereHastaFecha,
            },
          },
        }),
        this.prisma.persona.count({
          where: {
            caso: {
              ...whereHastaFecha,
            },
            OR: [
              {
                tipoPersona: TipoPersona.MENOR,
              },
              {
                edad: {
                  lt: 18,
                },
              },
            ],
          },
        }),
      ]);

    const diasConConteo = new Map<string, number>();
    for (let i = 0; i < 7; i += 1) {
      const dia = new Date(inicioTendencia);
      dia.setDate(inicioTendencia.getDate() + i);
      const iso = this.fechaClaveLocal(dia);
      diasConConteo.set(iso, 0);
    }

    casosParaTendencia.forEach((item) => {
      const iso = this.fechaClaveLocal(new Date(item.fechaHoraProcedimiento));
      if (!diasConConteo.has(iso)) {
        return;
      }
      diasConConteo.set(iso, (diasConConteo.get(iso) ?? 0) + 1);
    });

    const tendenciaDiaria = Array.from(diasConConteo.entries()).map(
      ([fecha, total]) => ({
        fecha,
        etiqueta: this.formatearEtiquetaDia(fecha),
        total,
      }),
    );

    const porTipoControl = (
      [TipoControl.INGRESO, TipoControl.EGRESO, TipoControl.TERRITORIO] as const
    ).map((tipo) => ({
      tipo,
      total:
        casosPorTipoControl.find((item) => item.tipoControl === tipo)?._count
          .tipoControl ?? 0,
    }));

    const porDerivacion = (
      [
        InstitucionDerivacion.CARABINEROS,
        InstitucionDerivacion.PDI,
        InstitucionDerivacion.NINGUNA,
      ] as const
    ).map((institucion) => ({
      institucion,
      total:
        casosPorDerivacion.find(
          (item) => item.institucionDerivacion === institucion,
        )?._count.institucionDerivacion ?? 0,
    }));

    const documentadoSi =
      casosPorDocumentado.find((item) => item.documentado)?._count.documentado ??
      0;
    const documentadoNo =
      casosPorDocumentado.find((item) => !item.documentado)?._count.documentado ??
      0;

    const conMenores =
      casosPorMenores.find((item) => item.existenMenores)?._count
        .existenMenores ?? 0;
    const sinMenores =
      casosPorMenores.find((item) => !item.existenMenores)?._count
        .existenMenores ?? 0;

    const totalPersonasMayores = Math.max(
      totalPersonas - totalPersonasMenores,
      0,
    );

    const estadoDocumentacion = (
      [
        EstadoCaso.PENDIENTE,
        EstadoCaso.DERIVADO_CARABINEROS,
        EstadoCaso.DERIVADO_PDI,
        EstadoCaso.CERRADO,
      ] as const
    ).map((estado) => ({
      estado,
      documentado:
        estadoPorDocumentado.find(
          (item) => item.estado === estado && item.documentado,
        )?._count.estado ?? 0,
      noDocumentado:
        estadoPorDocumentado.find(
          (item) => item.estado === estado && !item.documentado,
        )?._count.estado ?? 0,
    }));

    return {
      totales: {
        dia: totalDia,
        semana: totalSemana,
        mes: totalMes,
      },
      casosPorEstado: casosPorEstado.map((item) => ({
        estado: item.estado,
        total: item._count.estado,
      })),
      tendenciaDiaria,
      porTipoControl,
      porDerivacion,
      documentacion: {
        si: documentadoSi,
        no: documentadoNo,
      },
      menores: {
        conMenores,
        sinMenores,
      },
      estadoDocumentacion,
      topUbicaciones: topUbicaciones.map((item) => ({
        lugar: item.lugar,
        total: item._count.lugar,
      })),
      topNacionalidades: topNacionalidades.map((item) => ({
        nacionalidad: item.nacionalidad,
        total: item._count.nacionalidad,
      })),
      personasEtarias: {
        mayores: totalPersonasMayores,
        menores: totalPersonasMenores,
      },
      metricasOperativas: {
        actasHoy: totalDia,
        menoresEdad: totalPersonasMenores,
        noDocumentados: documentadoNo,
        conLesiones: totalCasosConLesiones,
        pendientesFirma: totalCasosPendientesFirma,
        casosCerrados: totalCasosCerrados,
      },
      alertas: {
        menoresPendientes: totalCasosConMenorPendiente,
        lesionesRevision: totalCasosConLesiones,
        actasSinFirma: totalCasosPendientesFirma,
        sinCierreOperativo: totalCasosSinCierre,
      },
      actividadReciente,
      accesosRecientes,
      ultimosCasos,
    };
  }
}
