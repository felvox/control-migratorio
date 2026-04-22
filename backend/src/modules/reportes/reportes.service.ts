import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryReporteCasosDto } from './dto/query-reporte-casos.dto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private construirWhere(query: QueryReporteCasosDto): Prisma.CasoWhereInput {
    return {
      eliminadoAt: null,
      estado: query.estado,
      tipoControl: query.tipoControl,
      creadoPorId: query.operadorId,
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
      personas: query.nacionalidad
        ? {
            some: {
              nacionalidad: {
                contains: query.nacionalidad,
                mode: 'insensitive',
              },
            },
          }
        : undefined,
    };
  }

  private async obtenerCasosFiltrados(query: QueryReporteCasosDto) {
    const where = this.construirWhere(query);

    return this.prisma.caso.findMany({
      where,
      orderBy: {
        fechaHoraProcedimiento: 'desc',
      },
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
            nacionalidad: true,
            numeroDocumento: true,
            edad: true,
          },
        },
      },
    });
  }

  async exportarExcel(
    query: QueryReporteCasosDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const casos = await this.obtenerCasosFiltrados(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte Casos');

    sheet.columns = [
      { header: 'Código', key: 'codigo', width: 18 },
      { header: 'Fecha Procedimiento', key: 'fecha', width: 24 },
      { header: 'Tipo Control', key: 'tipoControl', width: 16 },
      { header: 'Estado', key: 'estado', width: 24 },
      { header: 'Institución Derivación', key: 'institucion', width: 22 },
      { header: 'Lugar', key: 'lugar', width: 24 },
      { header: 'Operador', key: 'operador', width: 24 },
      { header: 'Principal', key: 'principal', width: 28 },
      { header: 'Documento', key: 'documento', width: 18 },
      { header: 'Nacionalidad', key: 'nacionalidad', width: 18 },
      { header: 'Con Menores', key: 'menores', width: 12 },
    ];

    casos.forEach((caso) => {
      const principal = caso.personas.find((persona) => persona.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];
      sheet.addRow({
        codigo: caso.codigo,
        fecha: new Date(caso.fechaHoraProcedimiento).toLocaleString('es-CL'),
        tipoControl: caso.tipoControl,
        estado: caso.estado,
        institucion: caso.institucionDerivacion,
        lugar: caso.lugar,
        operador: caso.creadoPor.nombreCompleto,
        principal: principal ? `${principal.nombres} ${principal.apellidos}` : 'No registra',
        documento: principal?.numeroDocumento ?? 'No registra',
        nacionalidad: principal?.nacionalidad ?? 'No registra',
        menores: caso.existenMenores ? 'Sí' : 'No',
      });
    });

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      accion: 'EXPORTAR_REPORTE_EXCEL',
      entidad: 'REPORTE',
      descripcion: `Reporte Excel de casos generado (${casos.length} registros)` ,
      metadata: query as unknown as Record<string, unknown>,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return Buffer.from(buffer);
  }

  async exportarPdf(
    query: QueryReporteCasosDto,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const casos = await this.obtenerCasosFiltrados(query);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));

      doc.fontSize(14).text('Reporte de Casos de Control Migratorio', {
        align: 'center',
      });
      doc.moveDown(0.5);
      doc.fontSize(9).text(`Generado: ${new Date().toLocaleString('es-CL')}`);
      doc.text(`Total de registros: ${casos.length}`);
      doc.moveDown();

      casos.forEach((caso, index) => {
        const principal = caso.personas.find((persona) => persona.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];

        doc.fontSize(10).text(`${index + 1}. ${caso.codigo} - ${caso.estado}`);
        doc.fontSize(9).text(
          `${new Date(caso.fechaHoraProcedimiento).toLocaleString('es-CL')} | ${caso.tipoControl} | ${caso.lugar}`,
        );
        doc.text(
          `Principal: ${principal ? `${principal.nombres} ${principal.apellidos}` : 'No registra'} | Documento: ${principal?.numeroDocumento ?? 'No registra'} | Nacionalidad: ${principal?.nacionalidad ?? 'No registra'}`,
        );
        doc.text(
          `Operador: ${caso.creadoPor.nombreCompleto} | Menores: ${caso.existenMenores ? 'Sí' : 'No'} | Derivación: ${caso.institucionDerivacion}`,
        );
        doc.moveDown(0.5);

        if (doc.y > 760) {
          doc.addPage();
        }
      });

      doc.end();
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      accion: 'EXPORTAR_REPORTE_PDF',
      entidad: 'REPORTE',
      descripcion: `Reporte PDF de casos generado (${casos.length} registros)` ,
      metadata: query as unknown as Record<string, unknown>,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return buffer;
  }
}
