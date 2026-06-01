import { BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { TipoEvidencia } from '@prisma/client';
import { UploadEvidenciaDto } from './dto/upload-evidencia.dto';

const execFileAsync = promisify(execFile);

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];

export interface ArchivoNormalizado {
  buffer: Buffer;
  nombreOriginal: string;
  mimeType: string;
  extension: string;
  tamanoBytes: number;
  fueConvertidoDesdeWord: boolean;
}

export function validarTamanoArchivo(
  file: Express.Multer.File,
  maxUploadSizeMb: number,
): void {
  const maxBytes = maxUploadSizeMb * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new BadRequestException(`El archivo excede el límite de ${maxUploadSizeMb}MB`);
  }
}

export function esArchivoPermitido(file: Express.Multer.File): boolean {
  const extension = extname(file.originalname).toLowerCase();
  return ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(extension);
}

export function esArchivoWord(file: Express.Multer.File): boolean {
  const extension = extname(file.originalname).toLowerCase();

  return (
    extension === '.doc' ||
    extension === '.docx' ||
    file.mimetype === 'application/msword' ||
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function nombrePdfDesdeOriginal(nombreOriginal: string): string {
  const extension = extname(nombreOriginal);
  const base = extension ? nombreOriginal.slice(0, -extension.length) : nombreOriginal;
  return `${base || 'documento'}.pdf`;
}

export async function normalizarArchivoSubido(
  file: Express.Multer.File,
): Promise<ArchivoNormalizado> {
  if (!esArchivoWord(file)) {
    return {
      buffer: file.buffer,
      nombreOriginal: file.originalname,
      mimeType: file.mimetype,
      extension: extname(file.originalname).toLowerCase(),
      tamanoBytes: file.size,
      fueConvertidoDesdeWord: false,
    };
  }

  const texto = await extraerTextoWord(file);
  const pdfBuffer = await crearPdfDesdeTexto(texto);

  return {
    buffer: pdfBuffer,
    nombreOriginal: nombrePdfDesdeOriginal(file.originalname),
    mimeType: 'application/pdf',
    extension: '.pdf',
    tamanoBytes: pdfBuffer.length,
    fueConvertidoDesdeWord: true,
  };
}

export function obtenerSubcarpetaEvidencia(
  dto: UploadEvidenciaDto,
  casoId: string,
  personaId?: string,
): string {
  const baseCaso = `casos/caso-${casoId}`;

  if (dto.tipoEvidencia === TipoEvidencia.ADJUNTO_GENERAL) {
    return `${baseCaso}/adjuntos`;
  }

  if (!personaId) {
    throw new BadRequestException(
      'personaId es obligatorio para foto o documento de identidad',
    );
  }

  const personaBase = `${baseCaso}/persona-${personaId}`;

  if (dto.tipoEvidencia === TipoEvidencia.FOTO_PERSONA) {
    return `${personaBase}/foto-persona`;
  }

  return `${personaBase}/documento-identidad`;
}

async function extraerTextoWord(file: Express.Multer.File): Promise<string> {
  const carpetaTemporal = await fs.mkdtemp(join(tmpdir(), 'evidencia-word-'));
  const extension = extname(file.originalname).toLowerCase();
  const rutaTemporal = join(carpetaTemporal, `origen${extension || '.docx'}`);
  const rutaTexto = join(carpetaTemporal, 'salida.txt');

  try {
    await fs.writeFile(rutaTemporal, file.buffer);

    try {
      await execFileAsync('textutil', [
        '-convert',
        'txt',
        '-output',
        rutaTexto,
        rutaTemporal,
      ]);
      return (await fs.readFile(rutaTexto, 'utf8')).trim();
    } catch (_error) {
      if (extension !== '.docx') {
        throw new BadRequestException(
          'No fue posible convertir el documento Word a PDF en este entorno.',
        );
      }

      const { stdout } = await execFileAsync('unzip', [
        '-p',
        rutaTemporal,
        'word/document.xml',
      ]);
      return limpiarXmlDocx(stdout).trim();
    }
  } finally {
    await fs.rm(carpetaTemporal, { force: true, recursive: true });
  }
}

function limpiarXmlDocx(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function crearPdfDesdeTexto(texto: string): Promise<Buffer> {
  return new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', rejectPromise);

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#111827')
      .text(texto || 'El documento Word no contiene texto extraíble.', {
        align: 'left',
        lineGap: 4,
      });

    doc.end();
  });
}
