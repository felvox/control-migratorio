import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TipoEvidencia } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadEvidenciaDto } from './dto/upload-evidencia.dto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { promises as fs } from 'fs';
import { extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class EvidenciasService {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];

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

  private async validarAccesoCaso(casoId: string, user: AuthUser) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id: casoId,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
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

  private async validarPersona(casoId: string, personaId?: string) {
    if (!personaId) {
      return null;
    }

    const persona = await this.prisma.persona.findFirst({
      where: {
        id: personaId,
        casoId,
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
      },
    });

    if (!persona) {
      throw new NotFoundException('La persona indicada no pertenece al caso');
    }

    return persona;
  }

  private getSubcarpeta(
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

  async subirEvidencia(
    casoId: string,
    dto: UploadEvidenciaDto,
    file: Express.Multer.File,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }

    const maxUploadSizeMb = this.configService.get<number>(
      'storage.maxUploadSizeMb',
      10,
    );
    const maxBytes = maxUploadSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `El archivo excede el límite de ${maxUploadSizeMb}MB`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo inválido. Permitidos: jpg, jpeg, png, pdf',
      );
    }

    const caso = await this.validarAccesoCaso(casoId, user);

    const requierePersona =
      dto.tipoEvidencia === TipoEvidencia.FOTO_PERSONA ||
      dto.tipoEvidencia === TipoEvidencia.DOCUMENTO_IDENTIDAD;

    if (requierePersona && !dto.personaId) {
      throw new BadRequestException(
        'personaId es obligatorio para este tipo de evidencia',
      );
    }

    const persona = await this.validarPersona(casoId, dto.personaId);

    const extension = extname(file.originalname).toLowerCase();
    const nombreGuardado = `${Date.now()}-${randomUUID()}${extension}`;
    const subcarpeta = this.getSubcarpeta(dto, casoId, dto.personaId);
    const rutaArchivoRelativa = `${subcarpeta}/${nombreGuardado}`;
    const rutaAbsoluta = join(this.storageRoot, rutaArchivoRelativa);

    await fs.mkdir(join(this.storageRoot, subcarpeta), { recursive: true });
    await fs.writeFile(rutaAbsoluta, file.buffer);

    const evidencia = await this.prisma.evidencia.create({
      data: {
        casoId,
        personaId: dto.personaId,
        tipoEvidencia: dto.tipoEvidencia,
        nombreOriginal: file.originalname,
        nombreGuardado,
        rutaArchivo: rutaArchivoRelativa,
        mimeType: file.mimetype,
        tamanoBytes: file.size,
        creadoPorId: user.id,
      },
    });

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId,
      accion: 'CARGAR_EVIDENCIA',
      entidad: 'EVIDENCIA',
      entidadId: evidencia.id,
      descripcion: `Evidencia cargada en caso ${caso.codigo}`,
      metadata: {
        tipoEvidencia: dto.tipoEvidencia,
        personaId: dto.personaId,
        persona: persona ? `${persona.nombres} ${persona.apellidos}` : null,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return evidencia;
  }

  async listarPorCaso(casoId: string, user: AuthUser) {
    await this.validarAccesoCaso(casoId, user);

    return this.prisma.evidencia.findMany({
      where: { casoId },
      include: {
        persona: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            numeroDocumento: true,
          },
        },
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

  async obtenerParaDescarga(id: string, user: AuthUser) {
    const evidencia = await this.prisma.evidencia.findUnique({
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

    if (!evidencia) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    if (user.role === Role.OPERADOR && evidencia.caso.creadoPorId !== user.id) {
      throw new ForbiddenException('No tiene permisos para esta evidencia');
    }

    const rutaAbsoluta = join(this.storageRoot, evidencia.rutaArchivo);

    try {
      await fs.access(rutaAbsoluta);
    } catch (_error) {
      throw new NotFoundException('Archivo de evidencia no encontrado en storage');
    }

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: evidencia.casoId,
      accion: 'DESCARGAR_EVIDENCIA',
      entidad: 'EVIDENCIA',
      entidadId: evidencia.id,
      descripcion: `Descarga de evidencia ${evidencia.nombreOriginal}`,
    });

    return {
      evidencia,
      rutaAbsoluta,
    };
  }
}
