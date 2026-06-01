import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import PDFDocument from 'pdfkit';
import {
  PDFDocument as PDFLibDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { validarAccesoInstitucionalCaso } from '../casos/casos-acceso-institucional.utils';
import {
  detectarLesiones,
  etiquetaJaf,
  formatearFecha,
  formatearHora,
  formatearMesAbreviadoMayuscula,
  limpiarObservacionesParaActa,
  ordenarEvidenciasParaAnexo,
  separarGradoYNombreFuncionario,
  tituloTipoEvidencia,
} from './documentos-presentacion.utils';

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

    validarAccesoInstitucionalCaso(caso, user, {
      noPermisoPropio: 'No tiene permisos para este caso',
      noPermisoJaf: 'No tiene permisos para casos de otra JAF',
      noPermisoCarabineros:
        'Solo puede consultar documentos de casos de Carabineros o seguimiento de menores derivados a PDI',
      noPermisoPdi: 'Solo puede consultar documentos de casos derivados a PDI',
    });

    return caso;
  }

  private async renderActaPDF(params: {
    rutaAbsoluta: string;
    caso: Awaited<ReturnType<DocumentosService['obtenerCasoConAcceso']>>;
    usuarioGenerador: AuthUser;
  }) {
    const { rutaAbsoluta, caso, usuarioGenerador } = params;

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const doc = new PDFDocument({
        margin: 0,
        size: 'A4',
      });

      const stream = createWriteStream(rutaAbsoluta);
      doc.pipe(stream);

      const left = 36;
      const top = 38;
      const contentWidth = doc.page.width - left * 2;
      const rightLimit = left + contentWidth;
      const lineColor = '#000000';
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];
      const menores = caso.personas.filter((p) => p.tipoPersona === 'MENOR');
      const observacionesLimpias = limpiarObservacionesParaActa(caso.observaciones);
      let cursorY = top;

      const ensureSpace = (height: number) => {
        if (cursorY + height <= doc.page.height - top) {
          return;
        }

        doc.addPage({ margin: 0, size: 'A4' });
        cursorY = top;
      };

      const valor = (texto?: string | null, fallback = '') =>
        (texto ?? '').trim() || fallback;
      const procesado = new Date(caso.fechaHoraProcedimiento);
      const fechaIngreso = caso.fechaIngreso ? new Date(caso.fechaIngreso) : null;
      const presentaLesiones = detectarLesiones(caso.estadoSalud);

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
      const labelColWidth = (contentWidth - checkColWidth * 2) / 2;
      const opcionesControl = [
        { key: 'INGRESO', label: 'INGRESANDO A\nTERRITORIO\nNACIONAL' },
        { key: 'EGRESO', label: 'EGRESANDO DE\nTERRITORIO NACIONAL' },
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
          `En ${valor(caso.lugar, '___________')}, a las ${formatearHora(procesado)} hrs. del día ${String(
            procesado.getDate(),
          ).padStart(2, '0')} del mes de ${formatearMesAbreviadoMayuscula(
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

      drawFieldLine(cursorY, 'Fecha de nacimiento', valor(principal ? formatearFecha(principal.fechaNacimiento) : ''), {
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

      if (caso.existenMenores && menores.length > 0) {
        menores.forEach((menor, menorIndex) => {
          ensureSpace(92);
          const numeracion = String(menorIndex + 1).padStart(2, '0');
          doc
            .font('Times-Bold')
            .fontSize(12)
            .text(`${numeracion} ANTECEDENTES:`, left, cursorY);
          cursorY += 15;

          drawFieldLine(
            cursorY,
            'Nombre y apellidos',
            valor(`${menor.nombres} ${menor.apellidos}`),
          );
          cursorY += 16;
          drawFieldLine(
            cursorY,
            'F./Nacimiento',
            valor(formatearFecha(menor.fechaNacimiento)),
            {
              lineEndX: left + 278,
            },
          );
          drawFieldLine(cursorY, 'Edad', valor(String(menor.edad)), {
            labelX: left + 290,
            colonX: left + 338,
            lineStartX: left + 350,
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
        });
      }

      ensureSpace(142);
      doc.font('Times-Bold').fontSize(14).text('ANTECEDENTES MIGRATORIOS:', left, cursorY);
      cursorY += 16;

      drawFieldLine(cursorY, 'Lugar', valor(caso.lugar), {
        lineEndX: left + 323,
      });
      drawFieldLine(
        cursorY,
        'Fecha de ingreso',
        valor(fechaIngreso ? formatearFecha(fechaIngreso) : ''),
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

      ensureSpace(260);
      doc.font('Times-Bold').fontSize(14).text('OBSERVACIONES', left + 8, cursorY);
      cursorY += 18;

      const obsBoxHeight = 38;
      doc.rect(left, cursorY, contentWidth, obsBoxHeight).lineWidth(0.9).strokeColor(lineColor).stroke();
      doc
        .font('Times-Roman')
        .fontSize(10.4)
        .text(valor(observacionesLimpias, ''), left + 6, cursorY + 5, {
          width: contentWidth - 12,
          height: obsBoxHeight - 10,
        });
      cursorY += obsBoxHeight + 2;

      const conformidadHeight = 72;
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

      drawFieldLine(cursorY, 'Firma en conformidad', '', {
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
      cursorY += 18;
      ensureSpace(118);

      const firmaBlockWidth = contentWidth / 2;
      const receptor = caso.existenMenores
        ? 'FUNCIONARIO QUE RECIBE/ENTREGA DE CARABINEROS'
        : 'FUNCIONARIO QUE RECIBE/ENTREGA DE PDI';
      const funcionarioEntrega = separarGradoYNombreFuncionario(
        caso.creadoPor?.nombreCompleto,
      );
      const debeCompletarReceptorCarabineros =
        caso.existenMenores && usuarioGenerador.role === Role.CARABINEROS;
      const funcionarioReceptor =
        debeCompletarReceptorCarabineros
          ? separarGradoYNombreFuncionario(usuarioGenerador.nombreCompleto)
          : { grado: '', nombre: '' };
      const unidadReceptor = debeCompletarReceptorCarabineros
        ? etiquetaJaf(caso.jaf)
        : '';
      const leftSignX = left;
      const rightSignX = left + firmaBlockWidth;
      const firmaHeaderHeight = 24;
      const firmaRowHeight = 19;
      const firmaRows = ['Firma', 'Nombre', 'Grado', 'Unidad'];
      const firmaTableHeight = firmaHeaderHeight + firmaRows.length * firmaRowHeight;
      const colonOffset = 72;

      doc
        .rect(leftSignX, cursorY, contentWidth, firmaTableHeight)
        .lineWidth(0.9)
        .strokeColor(lineColor)
        .stroke();
      drawLine(rightSignX, cursorY, rightSignX, cursorY + firmaTableHeight);
      drawLine(leftSignX, cursorY + firmaHeaderHeight, leftSignX + contentWidth, cursorY + firmaHeaderHeight);

      for (let index = 1; index < firmaRows.length; index += 1) {
        const y = cursorY + firmaHeaderHeight + firmaRowHeight * index;
        drawLine(leftSignX, y, leftSignX + contentWidth, y);
      }

      doc
        .font('Times-Bold')
        .fontSize(10.6)
        .text('FUNCIONARIO DE EJÉRCITO QUE ENTREGA', leftSignX + 4, cursorY + 4, {
          width: firmaBlockWidth - 8,
          align: 'center',
        })
        .text(receptor, rightSignX + 4, cursorY + 4, {
          width: firmaBlockWidth - 8,
          align: 'center',
        });

      const drawFirmaRow = (columnX: number, rowIndex: number, valueText = '') => {
        const rowY = cursorY + firmaHeaderHeight + rowIndex * firmaRowHeight + 3;
        const label = firmaRows[rowIndex];
        const lineStartX = columnX + colonOffset + 14;
        const lineEndX = columnX + firmaBlockWidth - 8;

        doc.font('Times-Roman').fontSize(11).text(label, columnX + 8, rowY);
        doc.font('Times-Roman').fontSize(11).text(':', columnX + colonOffset, rowY);
        drawLine(lineStartX, rowY + 13, lineEndX, rowY + 13);
        if (valueText) {
          doc.font('Times-Roman').fontSize(10.7).text(valueText, lineStartX + 2, rowY, {
            width: lineEndX - lineStartX - 4,
            lineBreak: false,
          });
        }
      };

      firmaRows.forEach((_, rowIndex) => {
        let valorColumnaIzquierda = '';
        let valorColumnaDerecha = '';

        if (rowIndex === 1) {
          valorColumnaIzquierda =
            funcionarioEntrega.nombre || valor(caso.creadoPor?.nombreCompleto);
        } else if (rowIndex === 2) {
          valorColumnaIzquierda = funcionarioEntrega.grado;
        }

        if (rowIndex === 1) {
          valorColumnaDerecha = debeCompletarReceptorCarabineros
            ? funcionarioReceptor.nombre || usuarioGenerador.nombreCompleto
            : '';
        } else if (rowIndex === 2) {
          valorColumnaDerecha = funcionarioReceptor.grado;
        } else if (rowIndex === 3) {
          valorColumnaDerecha = unidadReceptor;
        }

        drawFirmaRow(leftSignX, rowIndex, valorColumnaIzquierda);
        drawFirmaRow(rightSignX, rowIndex, valorColumnaDerecha);
      });

      doc.end();

      stream.on('finish', () => resolvePromise());
      stream.on('error', (error) => rejectPromise(error));
    });

    await this.anexarEvidenciasAlPdf(rutaAbsoluta, caso.evidencias);
  }

  private async anexarEvidenciasAlPdf(
    rutaAbsoluta: string,
    evidencias: Awaited<
      ReturnType<DocumentosService['obtenerCasoConAcceso']>
    >['evidencias'],
  ) {
    if (!evidencias.length) {
      return;
    }

    const evidenciasOrdenadas = ordenarEvidenciasParaAnexo(evidencias);
    const basePdfBytes = await fs.readFile(rutaAbsoluta);
    const pdfFinal = await PDFLibDocument.load(basePdfBytes);
    const fontTitulo = await pdfFinal.embedFont(StandardFonts.HelveticaBold);
    const fontTexto = await pdfFinal.embedFont(StandardFonts.Helvetica);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 38;
    const tituloY = pageHeight - 42;
    const areaSuperiorY = pageHeight - 88;
    const areaInferiorY = 42;
    const slotsPorPagina = 3;
    const separacionSlots = 14;
    const slotWidth = pageWidth - margin * 2;
    const slotHeight =
      (areaSuperiorY - areaInferiorY - separacionSlots * (slotsPorPagina - 1)) /
      slotsPorPagina;
    const slotPadding = 12;
    const altoEtiqueta = 22;
    const areaImagenBorde = rgb(0.82, 0.86, 0.9);
    const areaSlotBorde = rgb(0.75, 0.8, 0.86);

    let paginaActual: ReturnType<typeof pdfFinal.addPage> | null = null;
    let slotActual = 0;

    const crearPaginaAnexo = () => {
      const pagina = pdfFinal.addPage([pageWidth, pageHeight]);
      pagina.drawText('ANEXO DE EVIDENCIAS', {
        x: margin,
        y: tituloY,
        size: 14,
        font: fontTitulo,
        color: rgb(0.1, 0.12, 0.16),
      });
      return pagina;
    };

    const tomarSiguienteSlot = () => {
      if (!paginaActual || slotActual >= slotsPorPagina) {
        paginaActual = crearPaginaAnexo();
        slotActual = 0;
      }

      const slotY =
        areaSuperiorY -
        slotHeight -
        slotActual * (slotHeight + separacionSlots);
      slotActual += 1;

      return { pagina: paginaActual, slotY };
    };

    const dibujarMarcoSlot = (pagina: ReturnType<typeof pdfFinal.addPage>, slotY: number, etiqueta: string) => {
      const slotX = margin;
      pagina.drawRectangle({
        x: slotX,
        y: slotY,
        width: slotWidth,
        height: slotHeight,
        borderColor: areaSlotBorde,
        borderWidth: 1,
      });

      pagina.drawText(etiqueta, {
        x: slotX + slotPadding,
        y: slotY + slotHeight - slotPadding - 10,
        size: 10,
        font: fontTexto,
        color: rgb(0.32, 0.38, 0.45),
      });

      const frameX = slotX + slotPadding;
      const frameY = slotY + slotPadding;
      const frameWidth = slotWidth - slotPadding * 2;
      const frameHeight = slotHeight - slotPadding * 2 - altoEtiqueta;

      pagina.drawRectangle({
        x: frameX,
        y: frameY,
        width: frameWidth,
        height: frameHeight,
        borderColor: areaImagenBorde,
        borderWidth: 1,
      });

      return { frameX, frameY, frameWidth, frameHeight };
    };

    for (let index = 0; index < evidenciasOrdenadas.length; index += 1) {
      const evidencia = evidenciasOrdenadas[index];
      const rutaEvidencia = join(this.storageRoot, evidencia.rutaArchivo);

      try {
        await fs.access(rutaEvidencia);
      } catch (_error) {
        continue;
      }

      const contenidoBytes = await fs.readFile(rutaEvidencia);
      const mime = evidencia.mimeType.toLowerCase();

      if (mime === 'application/pdf') {
        const pdfAdjunto = await PDFLibDocument.load(contenidoBytes);
        const totalPaginas = pdfAdjunto.getPageCount();

        for (let paginaAdjuntaIndex = 0; paginaAdjuntaIndex < totalPaginas; paginaAdjuntaIndex += 1) {
          const [paginaAdjunta] = await pdfFinal.embedPdf(contenidoBytes, [paginaAdjuntaIndex]);
          const { pagina, slotY } = tomarSiguienteSlot();
          const subtitulo = totalPaginas > 1
            ? `${index + 1}. ${tituloTipoEvidencia(evidencia.tipoEvidencia)} - ${evidencia.nombreOriginal} (${paginaAdjuntaIndex + 1}/${totalPaginas})`
            : `${index + 1}. ${tituloTipoEvidencia(evidencia.tipoEvidencia)} - ${evidencia.nombreOriginal}`;

          const { frameX, frameY, frameWidth, frameHeight } = dibujarMarcoSlot(
            pagina,
            slotY,
            subtitulo,
          );
          const maxWidth = frameWidth - 10;
          const maxHeight = frameHeight - 10;
          const escala = Math.min(
            maxWidth / paginaAdjunta.width,
            maxHeight / paginaAdjunta.height,
          );
          const targetWidth = paginaAdjunta.width * escala;
          const targetHeight = paginaAdjunta.height * escala;
          const x = frameX + (frameWidth - targetWidth) / 2;
          const y = frameY + (frameHeight - targetHeight) / 2;

          pagina.drawPage(paginaAdjunta, {
            x,
            y,
            width: targetWidth,
            height: targetHeight,
          });
        }

        continue;
      }

      const { pagina, slotY } = tomarSiguienteSlot();
      const etiqueta = `${index + 1}. ${tituloTipoEvidencia(
        evidencia.tipoEvidencia,
      )} - ${evidencia.nombreOriginal}`;
      const { frameX, frameY, frameWidth, frameHeight } = dibujarMarcoSlot(
        pagina,
        slotY,
        etiqueta,
      );

      if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg') {
        const imagen =
          mime === 'image/png'
            ? await pdfFinal.embedPng(contenidoBytes)
            : await pdfFinal.embedJpg(contenidoBytes);

        const maxWidth = frameWidth - 10;
        const maxHeight = frameHeight - 10;
        const escala = Math.min(maxWidth / imagen.width, maxHeight / imagen.height);
        const targetWidth = imagen.width * escala;
        const targetHeight = imagen.height * escala;
        const x = frameX + (frameWidth - targetWidth) / 2;
        const y = frameY + (frameHeight - targetHeight) / 2;

        pagina.drawImage(imagen, {
          x,
          y,
          width: targetWidth,
          height: targetHeight,
        });
        continue;
      }

      const mensajeNoPrevisualizable =
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? 'Documento Word cargado. Disponible para descarga desde evidencias.'
          : 'Formato no soportado para previsualización en anexo.';

      pagina.drawText(mensajeNoPrevisualizable, {
        x: frameX + 12,
        y: frameY + frameHeight / 2,
        size: 11,
        font: fontTexto,
        color: rgb(0.5, 0.1, 0.1),
      });
    }

    const pdfBytesFinales = await pdfFinal.save();
    await fs.writeFile(rutaAbsoluta, pdfBytesFinales);
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
      usuarioGenerador: user,
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
            jaf: true,
            institucionDerivacion: true,
            existenMenores: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    validarAccesoInstitucionalCaso(documento.caso, user, {
      noPermisoPropio: 'No tiene permisos para este documento',
      noPermisoJaf: 'No tiene permisos para documentos de otra JAF',
      noPermisoCarabineros:
        'Solo puede consultar documentos de casos de Carabineros o seguimiento de menores derivados a PDI',
      noPermisoPdi: 'Solo puede consultar documentos de casos derivados a PDI',
    });

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
