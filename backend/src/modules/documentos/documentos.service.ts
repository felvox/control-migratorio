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
        margin: 36,
        size: 'A4',
      });

      const stream = createWriteStream(rutaAbsoluta);
      doc.pipe(stream);

      const mainColor = '#1f354a';
      const borderColor = '#c9d4e3';
      const textColor = '#1a1a1a';
      const left = 36;
      const top = 36;
      const contentWidth = doc.page.width - left * 2;
      const rightLimit = left + contentWidth;
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];
      const menor = caso.personas.find((p) => p.tipoPersona === 'MENOR');
      const observacionesLimpias = this.limpiarObservacionesParaActa(caso.observaciones);
      const conteoEvidencias = caso.evidencias.length;
      const formato = caso.existenMenores
        ? 'FORMATO CON MENOR DE EDAD'
        : 'FORMATO MAYOR DE EDAD';
      let cursorY = top;

      const ensureSpace = (height: number) => {
        if (cursorY + height <= doc.page.height - top) {
          return;
        }

        doc.addPage();
        cursorY = top;
      };

      const drawHeader = () => {
        const headerHeight = 88;
        ensureSpace(headerHeight + 6);
        doc
          .roundedRect(left, cursorY, contentWidth, headerHeight, 8)
          .lineWidth(1)
          .strokeColor(borderColor)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(textColor)
          .text('REPÚBLICA DE CHILE', left + 12, cursorY + 10, {
            width: 180,
          })
          .font('Helvetica')
          .fontSize(8.5)
          .text('JAF “TARAPACÁ”', left + 12, cursorY + 24, { width: 180 })
          .text('Puesto Mando FT “Tarapacá 76”', left + 12, cursorY + 36, {
            width: 180,
          });

        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor(mainColor)
          .text('ACTA DE CONTROL MIGRATORIO', left + 168, cursorY + 18, {
            width: contentWidth - 180,
            align: 'center',
          });

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#31506a')
          .text(formato, left + 170, cursorY + 48, {
            width: contentWidth - 184,
            align: 'center',
          });

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(textColor)
          .text(`Código: ${caso.codigo}`, rightLimit - 185, cursorY + 10, {
            width: 170,
            align: 'right',
          })
          .text(`Emitido: ${this.formatearFechaHora(new Date())}`, rightLimit - 185, cursorY + 23, {
            width: 170,
            align: 'right',
          });

        cursorY += headerHeight + 8;
      };

      const writeRow = (label: string, value: string, x: number, y: number, width: number) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9.6)
          .fillColor(textColor)
          .text(`${label}: `, x, y, {
            width,
            continued: true,
          })
          .font('Helvetica')
          .text(value || 'No registra', {
            width,
          });
      };

      const drawBox = (
        title: string,
        lines: Array<{ label: string; value: string }>,
        heightHint?: number,
      ) => {
        const baseHeight = heightHint ?? 34 + lines.length * 16;
        ensureSpace(baseHeight + 6);

        const startY = cursorY;
        const innerX = left + 12;
        const innerWidth = contentWidth - 24;
        let lineY = startY + 24;

        doc
          .roundedRect(left, startY, contentWidth, baseHeight, 8)
          .lineWidth(1)
          .strokeColor(borderColor)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(10.8)
          .fillColor(mainColor)
          .text(title, innerX, startY + 8, {
            width: innerWidth,
          });

        lines.forEach((line) => {
          writeRow(line.label, line.value, innerX, lineY, innerWidth);
          lineY = doc.y + 1.5;
        });

        cursorY = Math.max(startY + baseHeight, lineY + 8);
      };

      drawHeader();

      drawBox('1. DATOS DEL PROCEDIMIENTO', [
        { label: 'Tipo de control', value: this.etiquetaTipoControl(caso.tipoControl) },
        {
          label: 'Fecha y hora del procedimiento',
          value: this.formatearFechaHora(caso.fechaHoraProcedimiento),
        },
        { label: 'Lugar', value: caso.lugar },
        { label: 'Coordenadas', value: caso.coordenadas ?? 'No registra' },
        {
          label: 'Fecha de ingreso',
          value: caso.fechaIngreso ? this.formatearFecha(caso.fechaIngreso) : 'No registra',
        },
      ]);

      if (principal) {
        drawBox('2. ANTECEDENTES PERSONALES', [
          {
            label: 'Nombres y apellidos',
            value: `${principal.nombres} ${principal.apellidos}`.trim(),
          },
          { label: 'Nacionalidad', value: principal.nacionalidad },
          {
            label: 'Fecha de nacimiento y edad',
            value: `${this.formatearFecha(principal.fechaNacimiento)} / ${principal.edad} años`,
          },
          { label: 'Lugar de nacimiento', value: principal.lugarNacimiento ?? 'No registra' },
          { label: 'N° documento', value: principal.numeroDocumento },
          { label: 'Profesión u oficio', value: principal.profesionOficio ?? 'No registra' },
          { label: 'Estado civil', value: principal.estadoCivil ?? 'No registra' },
          { label: 'Domicilio', value: principal.domicilio ?? 'No registra' },
          {
            label: 'Teléfono',
            value: principal.telefono ?? 'No registra',
          },
        ]);
      }

      if (caso.existenMenores && menor) {
        drawBox('3. ANTECEDENTES DEL MENOR', [
          {
            label: 'Nombres y apellidos',
            value: `${menor.nombres} ${menor.apellidos}`.trim(),
          },
          { label: 'Nacionalidad', value: menor.nacionalidad },
          {
            label: 'Fecha de nacimiento y edad',
            value: `${this.formatearFecha(menor.fechaNacimiento)} / ${menor.edad} años`,
          },
          { label: 'Ciudad de origen', value: menor.lugarNacimiento ?? 'No registra' },
          { label: 'Documento', value: menor.numeroDocumento },
        ]);
      }

      drawBox(
        caso.existenMenores ? '4. ANTECEDENTES MIGRATORIOS' : '3. ANTECEDENTES MIGRATORIOS',
        [
          { label: 'Documentado', value: caso.documentado ? 'Sí' : 'No' },
          { label: 'Estado de salud', value: caso.estadoSalud ?? 'Sin información' },
          {
            label: 'Derivación automática',
            value: this.etiquetaInstitucion(caso.institucionDerivacion),
          },
          {
            label: 'Estado inicial',
            value: this.etiquetaEstado(caso.estado),
          },
        ],
      );

      const conteoPorTipo = {
        foto: caso.evidencias.filter((e) => e.tipoEvidencia === 'FOTO_PERSONA').length,
        documento: caso.evidencias.filter((e) => e.tipoEvidencia === 'DOCUMENTO_IDENTIDAD')
          .length,
        adjunto: caso.evidencias.filter((e) => e.tipoEvidencia === 'ADJUNTO_GENERAL').length,
      };

      drawBox(
        caso.existenMenores ? '5. EVIDENCIAS' : '4. EVIDENCIAS',
        [
          { label: 'Total evidencias', value: String(conteoEvidencias) },
          { label: 'Foto persona', value: String(conteoPorTipo.foto) },
          { label: 'Documento identidad', value: String(conteoPorTipo.documento) },
          { label: 'Adjuntos generales', value: String(conteoPorTipo.adjunto) },
        ],
        112,
      );

      const tituloObs = caso.existenMenores
        ? '6. OBSERVACIONES Y CONFORMIDAD'
        : '5. OBSERVACIONES Y CONFORMIDAD';
      const obsHeight = 120;
      ensureSpace(obsHeight + 6);
      doc
        .roundedRect(left, cursorY, contentWidth, obsHeight, 8)
        .lineWidth(1)
        .strokeColor(borderColor)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(10.8)
        .fillColor(mainColor)
        .text(tituloObs, left + 12, cursorY + 8, { width: contentWidth - 24 });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(textColor)
        .text(observacionesLimpias || 'Sin observaciones registradas.', left + 12, cursorY + 28, {
          width: contentWidth - 24,
          height: 60,
        });
      cursorY += obsHeight + 8;

      const rutaMensaje = caso.existenMenores
        ? 'Ruta del procedimiento: Carabineros → PDI.'
        : 'Ruta del procedimiento: derivación directa a PDI.';
      const footerHeight = 86;
      ensureSpace(footerHeight + 4);
      doc
        .roundedRect(left, cursorY, contentWidth, footerHeight, 8)
        .lineWidth(1)
        .strokeColor(borderColor)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(mainColor)
        .text(rutaMensaje, left + 12, cursorY + 10, { width: contentWidth - 24 });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(textColor)
        .text(`Funcionario responsable: ${caso.creadoPor.nombreCompleto}`, left + 12, cursorY + 30);
      doc
        .moveTo(left + 12, cursorY + 58)
        .lineTo(left + 240, cursorY + 58)
        .strokeColor('#555')
        .stroke();
      doc
        .moveTo(left + 280, cursorY + 58)
        .lineTo(rightLimit - 12, cursorY + 58)
        .strokeColor('#555')
        .stroke();
      doc
        .fontSize(9)
        .text('Firma', left + 12, cursorY + 62)
        .text('Aclaración', left + 280, cursorY + 62);

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
    return new Date(fecha).toLocaleString('es-CL');
  }

  private formatearFecha(fecha: Date | string): string {
    return new Date(fecha).toLocaleDateString('es-CL');
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
