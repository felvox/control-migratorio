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
        margin: 40,
        size: 'A4',
      });

      const stream = createWriteStream(rutaAbsoluta);
      doc.pipe(stream);

      doc.fontSize(16).text('ACTA DE CONTROL MIGRATORIO', {
        align: 'center',
      });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Código de caso: ${caso.codigo}`);
      doc.text(`Fecha emisión: ${new Date().toLocaleString('es-CL')}`);
      doc.moveDown();

      doc.fontSize(12).text('1. Datos del procedimiento', { underline: true });
      doc.fontSize(10);
      doc.text(`Tipo de control: ${caso.tipoControl}`);
      doc.text(
        `Fecha y hora procedimiento: ${new Date(caso.fechaHoraProcedimiento).toLocaleString('es-CL')}`,
      );
      doc.text(`Lugar: ${caso.lugar}`);
      doc.text(`Coordenadas: ${caso.coordenadas ?? 'No registra'}`);
      doc.text(`Fecha de ingreso: ${caso.fechaIngreso ? new Date(caso.fechaIngreso).toLocaleDateString('es-CL') : 'No registra'}`);
      doc.text(`Documentado: ${caso.documentado ? 'Sí' : 'No'}`);
      doc.text(`Estado de salud: ${caso.estadoSalud ?? 'No registra'}`);
      doc.text(`Estado del caso: ${caso.estado}`);
      doc.text(`Institución de derivación: ${caso.institucionDerivacion}`);
      doc.moveDown();

      doc.fontSize(12).text('2. Antecedentes personales', { underline: true });
      doc.fontSize(10);
      caso.personas.forEach((persona, index) => {
        doc.text(`Persona ${index + 1} (${persona.tipoPersona})`);
        doc.text(`Nombre: ${persona.nombres} ${persona.apellidos}`);
        doc.text(`Nacionalidad: ${persona.nacionalidad}`);
        doc.text(`Fecha nacimiento: ${new Date(persona.fechaNacimiento).toLocaleDateString('es-CL')} | Edad: ${persona.edad}`);
        doc.text(`Lugar nacimiento: ${persona.lugarNacimiento ?? 'No registra'}`);
        doc.text(`Documento: ${persona.numeroDocumento}`);
        doc.text(`Profesión/Oficio: ${persona.profesionOficio ?? 'No registra'}`);
        doc.text(`Estado civil: ${persona.estadoCivil ?? 'No registra'}`);
        doc.text(`Domicilio: ${persona.domicilio ?? 'No registra'}`);
        doc.text(`Correo: ${persona.correo ?? 'No registra'} | Teléfono: ${persona.telefono ?? 'No registra'}`);
        doc.moveDown(0.5);
      });

      doc.fontSize(12).text('3. Observaciones', { underline: true });
      doc.fontSize(10).text(caso.observaciones ?? 'Sin observaciones');
      doc.moveDown();

      if (caso.existenMenores) {
        doc
          .fontSize(11)
          .fillColor('#8B0000')
          .text(
            'Caso con menores involucrados: la derivación inicial corresponde a Carabineros y luego PDI.',
          )
          .fillColor('black');
      } else {
        doc
          .fontSize(11)
          .fillColor('#0A4D68')
          .text('Caso sin menores involucrados: derivación directa a PDI.')
          .fillColor('black');
      }

      doc.moveDown();
      doc.fontSize(10).text(`Funcionario responsable: ${caso.creadoPor.nombreCompleto}`);
      doc.text('Firma: ________________________________');
      doc.text('Aclaración: ____________________________');

      doc.end();

      stream.on('finish', () => resolvePromise());
      stream.on('error', (error) => rejectPromise(error));
    });
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
