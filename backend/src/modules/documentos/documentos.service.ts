import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import PDFDocument from 'pdfkit';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  private get storageRoot() {
    return resolve(
      process.cwd(),
      this.configService.get<string>('storage.root', '../storage'),
    );
  }

  private async obtenerCasoConAcceso(casoId: string, user: AuthUser) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id: casoId,
        eliminadoAt: null,
      },
      include: {
        creadoPor: {
          select: {
            id: true,
            run: true,
            nombreCompleto: true,
            rol: true,
          },
        },
        evidencias: {
          orderBy: {
            creadoAt: 'asc',
          },
        },
        personas: {
          orderBy: {
            creadoAt: 'asc',
          },
        },
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    if (user.role === Role.OPERADOR && caso.creadoPorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para este caso');
    }

    return caso;
  }

  private async renderActaPDF(params: {
    rutaAbsoluta: string;
    caso: Awaited<ReturnType<DocumentosService['obtenerCasoConAcceso']>>;
  }) {
    const { rutaAbsoluta, caso } = params;

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const doc = new PDFDocument({
        margin: 0,
        size: 'A4',
      });

      const stream = createWriteStream(rutaAbsoluta);
      doc.pipe(stream);

      const left = 46;
      const top = 52;
      const contentWidth = doc.page.width - left * 2;
      const rightLimit = left + contentWidth;
      const lineColor = '#000000';
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];
      const menor = caso.personas.find((p) => p.tipoPersona === 'MENOR');
      const observacionesLimpias = this.limpiarObservacionesParaActa(caso.observaciones);
      let cursorY = top;

      const ensureSpace = (height: number) => {
        if (cursorY + height <= doc.page.height - top) {
          return;
        }

        doc.addPage();
        cursorY = top;
      };

      const valor = (texto?: string | null, fallback = '') =>
        (texto ?? '').trim() || fallback;
      const procesado = new Date(caso.fechaHoraProcedimiento);
      const fechaIngreso = caso.fechaIngreso ? new Date(caso.fechaIngreso) : null;
      const presentaLesiones = this.detectarLesiones(caso.estadoSalud);

      const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(lineColor).lineWidth(0.9).stroke();
      };

      const drawFieldLine = (
        fieldY: number,
        label: string,
        fieldValue: string,
        options?: {
          labelX?: number;
          colonX?: number;
          lineStartX?: number;
          lineEndX?: number;
        },
      ) => {
        const labelX = options?.labelX ?? left + 8;
        const colonX = options?.colonX ?? left + 176;
        const lineStartX = options?.lineStartX ?? left + 192;
        const lineEndX = options?.lineEndX ?? rightLimit - 2;

        doc.font('Times-Roman').fontSize(11).fillColor(lineColor).text(label, labelX, fieldY);
        doc.font('Times-Roman').fontSize(11).text(':', colonX, fieldY);
        drawLine(lineStartX, fieldY + 14, lineEndX, fieldY + 14);
        doc
          .font('Times-Roman')
          .fontSize(11)
          .fillColor(lineColor)
          .text(fieldValue, lineStartX + 2, fieldY + 1, {
            width: lineEndX - lineStartX - 6,
            height: 14,
            lineBreak: false,
          });
      };

      const drawCheckOption = (
        checkY: number,
        label: string,
        checked: boolean,
        x: number,
        width: number,
      ) => {
        doc.font('Times-Roman').fontSize(11).fillColor(lineColor).text(label, x, checkY);
        const mark = checked ? 'X' : '';
        doc
          .font('Times-Bold')
          .fontSize(13)
          .text(mark, x + width - 28, checkY - 1, { width: 20, align: 'center' });
        drawLine(x + width - 34, checkY + 13.5, x + width + 8, checkY + 13.5);
      };

      const drawCheckTitle = (checkY: number, label: string, x: number) => {
        doc.font('Times-Roman').fontSize(11).fillColor(lineColor).text(label, x, checkY);
      };

      doc.font('Times-Roman').fillColor(lineColor);
      drawLine(left + 2, cursorY + 2, left + 2, cursorY + 24);
      doc
        .font('Times-Roman')
        .fontSize(12)
        .text('REPÚBLICA DE CHILE', left + 20, cursorY, { width: 250, align: 'center' })
        .text('JAF “TARAPACÁ”', left + 20, cursorY + 20, { width: 250, align: 'center' })
        .text('Puesto Mando FT “Tarapacá 76”', left + 20, cursorY + 40, {
          width: 250,
          align: 'center',
        });

      doc
        .font('Times-Bold')
        .fontSize(16)
        .text('ACTA DE CONTROL MIGRATORIO', left, cursorY + 74, {
          width: contentWidth,
          align: 'center',
          underline: true,
        });

      cursorY += 106;

      const tablaX = left;
      const tablaY = cursorY;
      const tablaHeight = 62;
      const checkColWidth = 24;
      const labelColWidth = (contentWidth - checkColWidth * 3) / 3;
      const opcionesControl = [
        { key: 'INGRESO', label: 'INGRESANDO A\nTERRITORIO\nNACIONAL' },
        { key: 'EGRESO', label: 'EGRESANDO DE\nTERRITORIO NACIONAL' },
        { key: 'TERRITORIO', label: 'EN TERRITORIO NACIONAL' },
      ];

      doc.rect(tablaX, tablaY, contentWidth, tablaHeight).lineWidth(0.9).strokeColor(lineColor).stroke();

      let tableCursorX = tablaX;
      opcionesControl.forEach((opcion) => {
        doc.rect(tableCursorX, tablaY, checkColWidth, tablaHeight).stroke();
        if (caso.tipoControl === opcion.key) {
          doc
            .font('Times-Bold')
            .fontSize(16)
            .text('X', tableCursorX + 6, tablaY + 20, {
              width: checkColWidth - 12,
              align: 'center',
            });
        }
        tableCursorX += checkColWidth;
        doc.rect(tableCursorX, tablaY, labelColWidth, tablaHeight).stroke();
        doc
          .font('Times-Roman')
          .fontSize(8.8)
          .text(opcion.label, tableCursorX + 4, tablaY + 9, {
            width: labelColWidth - 8,
            align: 'center',
            lineGap: 0,
          });
        tableCursorX += labelColWidth;
      });

      cursorY += tablaHeight + 10;

      doc
        .font('Times-Roman')
        .fontSize(12)
        .text(
          `En ${valor(caso.lugar, '___________')}, a las ${this.formatearHora(procesado)} hrs. del día ${String(
            procesado.getDate(),
          ).padStart(2, '0')} del mes de ${this.formatearMesAbreviadoMayuscula(
            procesado,
          )} del año ${procesado.getFullYear()}, se hace entrega de:`,
          left,
          cursorY,
          {
            width: contentWidth,
          },
        );
      cursorY += 26;

      doc.font('Times-Bold').fontSize(14).text('ANTECEDENTES PERSONALES:', left, cursorY);
      cursorY += 16;

      drawFieldLine(
        cursorY,
        'Nombres y apellidos',
        valor(`${principal?.nombres ?? ''} ${principal?.apellidos ?? ''}`),
      );
      cursorY += 17;

      drawFieldLine(cursorY, 'Nacionalidad', valor(principal?.nacionalidad), {
        lineEndX: left + 327,
      });
      drawFieldLine(cursorY, 'Lugar de nacimiento', valor(principal?.lugarNacimiento), {
        labelX: left + 338,
        colonX: left + 446,
        lineStartX: left + 460,
      });
      cursorY += 17;

      drawFieldLine(cursorY, 'Fecha de nacimiento', valor(principal ? this.formatearFecha(principal.fechaNacimiento) : ''), {
        lineEndX: left + 327,
      });
      drawFieldLine(cursorY, 'EDAD', valor(principal ? String(principal.edad) : ''), {
        labelX: left + 338,
        colonX: left + 390,
        lineStartX: left + 404,
      });
      cursorY += 17;

      drawFieldLine(cursorY, 'C.I. / DNI / PASAPORTE', valor(principal?.numeroDocumento));
      cursorY += 17;

      drawFieldLine(cursorY, 'Profesión u oficio', valor(principal?.profesionOficio), {
        lineEndX: left + 367,
      });
      drawFieldLine(cursorY, 'Estado civil', valor(principal?.estadoCivil), {
        labelX: left + 370,
        colonX: left + 450,
        lineStartX: left + 464,
      });
      cursorY += 17;

      drawFieldLine(cursorY, 'Domicilio', valor(principal?.domicilio));
      cursorY += 17;
      drawFieldLine(cursorY, 'Correo electrónico', valor(principal?.correo));
      cursorY += 17;
      drawFieldLine(cursorY, 'Teléfono', valor(principal?.telefono));
      cursorY += 22;

      if (caso.existenMenores && menor) {
        doc.font('Times-Bold').fontSize(12).text('01 ANTECEDENTES MENOR:', left, cursorY);
        cursorY += 15;

        drawFieldLine(cursorY, 'Nombre y apellidos', valor(`${menor.nombres} ${menor.apellidos}`));
        cursorY += 16;
        drawFieldLine(cursorY, 'F./Nacimiento', valor(this.formatearFecha(menor.fechaNacimiento)), {
          lineEndX: left + 244,
        });
        drawFieldLine(cursorY, 'Edad', valor(String(menor.edad)), {
          labelX: left + 256,
          colonX: left + 308,
          lineStartX: left + 320,
          lineEndX: rightLimit - 2,
        });
        cursorY += 16;
        drawFieldLine(cursorY, 'Nacionalidad', valor(menor.nacionalidad), {
          lineEndX: left + 327,
        });
        drawFieldLine(cursorY, 'Ciudad de origen', valor(menor.lugarNacimiento), {
          labelX: left + 338,
          colonX: left + 446,
          lineStartX: left + 460,
        });
        cursorY += 16;
        drawFieldLine(cursorY, 'Acta Nac. o céd. Id.', valor(menor.numeroDocumento));
        cursorY += 18;
      }

      doc.font('Times-Bold').fontSize(14).text('ANTECEDENTES MIGRATORIOS:', left, cursorY);
      cursorY += 16;

      drawFieldLine(cursorY, 'Lugar', valor(caso.lugar), {
        lineEndX: left + 323,
      });
      drawFieldLine(
        cursorY,
        'Fecha de ingreso',
        valor(fechaIngreso ? this.formatearFecha(fechaIngreso) : ''),
        {
          labelX: left + 314,
          colonX: left + 423,
          lineStartX: left + 437,
        },
      );
      cursorY += 17;
      drawFieldLine(cursorY, 'Coordenadas', valor(caso.coordenadas));
      cursorY += 30;

      drawCheckTitle(cursorY, 'Documentado', left + 8);
      drawCheckOption(cursorY, 'SI', caso.documentado, left + 186, 78);
      drawCheckOption(cursorY, 'NO', !caso.documentado, left + 268, 78);
      cursorY += 28;

      doc.font('Times-Bold').fontSize(14).text('ESTADO DE SALUD', left + 8, cursorY - 2);
      cursorY += 16;
      drawCheckTitle(cursorY, 'Presenta lesiones', left + 8);
      drawCheckOption(cursorY, 'SI', presentaLesiones, left + 186, 78);
      drawCheckOption(cursorY, 'NO', !presentaLesiones, left + 268, 78);
      cursorY += 22;

      doc.font('Times-Bold').fontSize(14).text('OBSERVACIONES', left + 8, cursorY);
      cursorY += 18;

      const obsBoxHeight = 42;
      doc.rect(left, cursorY, contentWidth, obsBoxHeight).lineWidth(0.9).strokeColor(lineColor).stroke();
      doc
        .font('Times-Roman')
        .fontSize(10.4)
        .text(valor(observacionesLimpias, ''), left + 6, cursorY + 5, {
          width: contentWidth - 12,
          height: obsBoxHeight - 10,
        });
      cursorY += obsBoxHeight + 2;

      const conformidadHeight = 78;
      doc.rect(left, cursorY, contentWidth, conformidadHeight).lineWidth(0.9).strokeColor(lineColor).stroke();
      doc
        .font('Times-Roman')
        .fontSize(12)
        .text(
          'TOMA CONOCIMIENTO BAJO FIRMA, QUE SEGÚN EL ACUERDO INTERINTITUCIONAL DE COOPERACIÓN MIGRATORIA ENTRE EL MINISTERIO DEL INTERIOR Y SEGURIDAD PÚBLICA Y EL MINISTERIO DE GOBIERNO DEL ESTADO PLURINACIONAL DE BOLIVIA DEL 20 DE DICIEMBRE DEL 2024, SERÁ RETORNADO A BOLIVIA.',
          left + 8,
          cursorY + 8,
          {
            width: contentWidth - 16,
            align: 'justify',
            lineGap: 1,
          },
        );
      cursorY += conformidadHeight + 4;

      const consultadoHeight = 18;
      doc.rect(left, cursorY, contentWidth, consultadoHeight).lineWidth(0.9).strokeColor(lineColor).stroke();
      doc
        .font('Times-Bold')
        .fontSize(11)
        .text('CONSULTADO A PDI', left + 8, cursorY + 2, { width: 160 });
      cursorY += consultadoHeight + 6;

      drawFieldLine(cursorY, 'Firma en conformidad', valor('', ''), {
        labelX: left + 8,
        lineStartX: left + 164,
      });
      cursorY += 16;
      drawFieldLine(cursorY, 'Nombre y apellidos', valor(`${principal?.nombres ?? ''} ${principal?.apellidos ?? ''}`), {
        labelX: left + 8,
        lineStartX: left + 164,
      });
      cursorY += 16;
      drawFieldLine(cursorY, 'Cédula o pasaporte', valor(principal?.numeroDocumento), {
        labelX: left + 8,
        lineStartX: left + 164,
      });
      cursorY += 22;

      const firmaBlockWidth = (contentWidth - 16) / 2;
      const receptor = caso.existenMenores
        ? 'FUNCIONARIO QUE RECIBE/ENTREGA DE CARABINEROS'
        : 'FUNCIONARIO QUE RECIBE/ENTREGA DE PDI';
      const leftSignX = left;
      const rightSignX = left + firmaBlockWidth + 16;

      doc
        .font('Times-Bold')
        .fontSize(10.5)
        .text('FUNCIONARIO DE EJÉRCITO QUE ENTREGA', leftSignX + 6, cursorY, {
          width: firmaBlockWidth - 12,
          align: 'center',
        });
      doc
        .font('Times-Bold')
        .fontSize(10.5)
        .text(receptor, rightSignX + 6, cursorY, {
          width: firmaBlockWidth - 12,
          align: 'center',
        });
      cursorY += 14;

      const drawFirmaSet = (baseX: number, nombreFunc: string) => {
        drawFieldLine(cursorY, 'Firma', '', {
          labelX: baseX + 8,
          colonX: baseX + 54,
          lineStartX: baseX + 66,
          lineEndX: baseX + firmaBlockWidth - 6,
        });
        drawFieldLine(cursorY + 15, 'Nombre', valor(nombreFunc), {
          labelX: baseX + 8,
          colonX: baseX + 54,
          lineStartX: baseX + 66,
          lineEndX: baseX + firmaBlockWidth - 6,
        });
        drawFieldLine(cursorY + 30, 'Grado', '', {
          labelX: baseX + 8,
          colonX: baseX + 54,
          lineStartX: baseX + 66,
          lineEndX: baseX + firmaBlockWidth - 6,
        });
        drawFieldLine(cursorY + 45, 'Unidad', '', {
          labelX: baseX + 8,
          colonX: baseX + 54,
          lineStartX: baseX + 66,
          lineEndX: baseX + firmaBlockWidth - 6,
        });
      };

      drawFirmaSet(leftSignX, caso.creadoPor.nombreCompleto);
      drawFirmaSet(rightSignX, '');

      doc.end();

      stream.on('finish', () => resolvePromise());
      stream.on('error', (error) => rejectPromise(error));
    });
  }

  private etiquetaTipoControl(tipo: string): string {
    if (tipo === 'INGRESO') {
      return 'Ingresando a territorio nacional';
    }

    if (tipo === 'EGRESO') {
      return 'Egresando de territorio nacional';
    }

    return 'En territorio nacional';
  }

  private etiquetaEstado(estado: string): string {
    if (estado === 'DERIVADO_CARABINEROS') {
      return 'Derivado Carabineros';
    }

    if (estado === 'DERIVADO_PDI') {
      return 'Derivado PDI';
    }

    if (estado === 'CERRADO') {
      return 'Cerrado';
    }

    return 'Pendiente';
  }

  private etiquetaInstitucion(institucion: string): string {
    if (institucion === 'CARABINEROS') {
      return 'Carabineros';
    }

    if (institucion === 'PDI') {
      return 'PDI';
    }

    return 'Ninguna';
  }

  private formatearFechaHora(fecha: Date | string): string {
    const fechaValida = this.parseFecha(fecha);
    if (!fechaValida) {
      return '';
    }

    return fechaValida.toLocaleString('es-CL');
  }

  private formatearFecha(fecha: Date | string): string {
    const fechaValida = this.parseFecha(fecha);
    if (!fechaValida) {
      return '';
    }

    const dia = String(fechaValida.getUTCDate()).padStart(2, '0');
    const mes = String(fechaValida.getUTCMonth() + 1).padStart(2, '0');
    const ano = fechaValida.getUTCFullYear();

    return `${dia}-${mes}-${ano}`;
  }

  private formatearHora(fecha: Date | string): string {
    const fechaValida = this.parseFecha(fecha);
    if (!fechaValida) {
      return '';
    }

    return fechaValida.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatearMesAbreviadoMayuscula(fecha: Date | string): string {
    const fechaValida = this.parseFecha(fecha);
    if (!fechaValida) {
      return '';
    }

    return fechaValida
      .toLocaleDateString('es-CL', { month: 'short' })
      .replace('.', '')
      .trim()
      .toUpperCase();
  }

  private parseFecha(fecha: Date | string): Date | null {
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private detectarLesiones(estadoSalud: string | null | undefined): boolean {
    if (!estadoSalud) {
      return false;
    }

    const normalizado = estadoSalud
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalizado.includes('sin lesion')) {
      return false;
    }

    return normalizado.includes('lesion');
  }

  private limpiarObservacionesParaActa(observaciones: string | null | undefined): string {
    if (!observaciones) {
      return '';
    }

    const marcadorConformidad = '[CONFORMIDAD_SISTEMA]';
    const markerIndex = observaciones.indexOf(marcadorConformidad);

    if (markerIndex < 0) {
      return observaciones.trim();
    }

    return observaciones.slice(0, markerIndex).trim();
  }

  async generarActaPdf(
    casoId: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const caso = await this.obtenerCasoConAcceso(casoId, user);

    const carpetaRelativa = `casos/caso-${caso.id}/documentos`;
    const carpetaAbsoluta = join(this.storageRoot, carpetaRelativa);

    await fs.mkdir(carpetaAbsoluta, { recursive: true });

    const nombreGuardado = `acta-${Date.now()}-${randomUUID()}.pdf`;
    const rutaRelativa = `${carpetaRelativa}/${nombreGuardado}`;
    const rutaAbsoluta = join(this.storageRoot, rutaRelativa);

    await this.renderActaPDF({
      rutaAbsoluta,
      caso,
    });

    const stats = await fs.stat(rutaAbsoluta);

    const documento = await this.prisma.documentoGenerado.create({
      data: {
        casoId: caso.id,
        tipo: 'ACTA_PDF',
        nombreOriginal: `acta-${caso.codigo}.pdf`,
        nombreGuardado,
        rutaArchivo: rutaRelativa,
        mimeType: 'application/pdf',
        tamanoBytes: stats.size,
        creadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: caso.id,
      accion: 'GENERAR_PDF_ACTA',
      entidad: 'DOCUMENTO',
      entidadId: documento.id,
      descripcion: `Acta PDF generada para caso ${caso.codigo}`,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return documento;
  }

  async listarPorCaso(casoId: string, user: AuthUser) {
    await this.obtenerCasoConAcceso(casoId, user);

    return this.prisma.documentoGenerado.findMany({
      where: { casoId },
      include: {
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
          },
        },
      },
      orderBy: { creadoAt: 'desc' },
    });
  }

  async obtenerDescarga(id: string, user: AuthUser) {
    const documento = await this.prisma.documentoGenerado.findUnique({
      where: { id },
      include: {
        caso: {
          select: {
            id: true,
            codigo: true,
            creadoPorId: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (user.role === Role.OPERADOR && documento.caso.creadoPorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para este documento');
    }

    const rutaAbsoluta = join(this.storageRoot, documento.rutaArchivo);

    try {
      await fs.access(rutaAbsoluta);
    } catch (_error) {
      throw new NotFoundException('Archivo no encontrado en almacenamiento');
    }

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: documento.casoId,
      accion: 'DESCARGAR_DOCUMENTO',
      entidad: 'DOCUMENTO',
      entidadId: documento.id,
      descripcion: `Descarga de documento ${documento.nombreOriginal}`,
    });

    return {
      documento,
      stream: createReadStream(rutaAbsoluta),
    };
  }
}
