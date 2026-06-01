import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadEvidenciaDto } from './dto/upload-evidencia.dto';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import {
  esArchivoPermitido,
  esArchivoWord,
  normalizarArchivoSubido,
  obtenerSubcarpetaEvidencia,
  validarTamanoArchivo,
} from './evidencias-archivo.utils';
import {
  validarEliminacionInstitucional,
  validarEtapaCargaInstitucional,
  validarPersonaRequerida,
} from './evidencias-flujo.utils';
import { validarAccesoInstitucionalCaso } from '../casos/casos-acceso-institucional.utils';

@Injectable()
export class EvidenciasService {
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

  async convertirWordAPdf(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo Word');
    }

    const maxUploadSizeMb = this.configService.get<number>(
      'storage.maxUploadSizeMb',
      10,
    );
    validarTamanoArchivo(file, maxUploadSizeMb);

    if (!esArchivoWord(file)) {
      throw new BadRequestException('Debe adjuntar un archivo doc o docx');
    }

    const archivo = await normalizarArchivoSubido(file);

    return {
      buffer: archivo.buffer,
      nombreOriginal: archivo.nombreOriginal,
    };
  }

  private async validarAccesoCaso(
    casoId: string,
    user: AuthUser,
    restringirOperadorACreador = false,
  ) {
    const caso = await this.prisma.caso.findFirst({
      where: {
        id: casoId,
        eliminadoAt: null,
      },
      select: {
        id: true,
        codigo: true,
        creadoPorId: true,
        jaf: true,
        estado: true,
        institucionDerivacion: true,
        existenMenores: true,
      },
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }

    validarAccesoInstitucionalCaso(caso, user, {
      noPermisoPropio: 'No tiene permisos para este caso',
      noPermisoJaf: 'No tiene permisos para casos de otra JAF',
      noPermisoCarabineros:
        'Solo puede consultar evidencias de casos de Carabineros o seguimiento de menores derivados a PDI',
      noPermisoPdi: 'Solo puede consultar evidencias de casos derivados a PDI',
    }, { restringirOperadorACreador });

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
    validarTamanoArchivo(file, maxUploadSizeMb);

    if (!esArchivoPermitido(file)) {
      throw new BadRequestException(
        'Tipo de archivo inválido. Permitidos: jpg, jpeg, png, pdf, doc, docx',
      );
    }

    const caso = await this.validarAccesoCaso(casoId, user, true);
    validarEtapaCargaInstitucional(caso, dto, user);
    validarPersonaRequerida(dto);

    const persona = await this.validarPersona(casoId, dto.personaId);

    const archivoNormalizado = await normalizarArchivoSubido(file);
    const nombreGuardado = `${Date.now()}-${randomUUID()}${archivoNormalizado.extension}`;
    const subcarpeta = obtenerSubcarpetaEvidencia(dto, casoId, dto.personaId);
    const rutaArchivoRelativa = `${subcarpeta}/${nombreGuardado}`;
    const rutaAbsoluta = join(this.storageRoot, rutaArchivoRelativa);

    await fs.mkdir(join(this.storageRoot, subcarpeta), { recursive: true });
    await fs.writeFile(rutaAbsoluta, archivoNormalizado.buffer);

    const evidencia = await this.prisma.evidencia.create({
      data: {
        casoId,
        personaId: dto.personaId,
        tipoEvidencia: dto.tipoEvidencia,
        nombreOriginal: archivoNormalizado.nombreOriginal,
        nombreGuardado,
        rutaArchivo: rutaArchivoRelativa,
        mimeType: archivoNormalizado.mimeType,
        tamanoBytes: archivoNormalizado.tamanoBytes,
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
        convertidoDesdeWord: archivoNormalizado.fueConvertidoDesdeWord,
        nombreOriginalSubido: file.originalname,
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
            jaf: true,
            institucionDerivacion: true,
            existenMenores: true,
          },
        },
      },
    });

    if (!evidencia) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    validarAccesoInstitucionalCaso(evidencia.caso, user, {
      noPermisoPropio: 'No tiene permisos para esta evidencia',
      noPermisoJaf: 'No tiene permisos para evidencias de otra JAF',
      noPermisoCarabineros:
        'Solo puede consultar evidencias de casos de Carabineros o seguimiento de menores derivados a PDI',
      noPermisoPdi: 'Solo puede consultar evidencias de casos derivados a PDI',
    });

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

  async eliminarEvidencia(
    id: string,
    user: AuthUser,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const evidencia = await this.prisma.evidencia.findUnique({
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

    if (!evidencia) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    const caso = await this.validarAccesoCaso(evidencia.casoId, user, true);
    validarEtapaCargaInstitucional(
      caso,
      {
        tipoEvidencia: evidencia.tipoEvidencia,
        personaId: evidencia.personaId ?? undefined,
      },
      user,
    );
    validarEliminacionInstitucional(evidencia.tipoEvidencia, user.role);

    await this.prisma.evidencia.delete({
      where: { id: evidencia.id },
    });

    const rutaAbsoluta = join(this.storageRoot, evidencia.rutaArchivo);
    await fs.unlink(rutaAbsoluta).catch(() => undefined);

    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      casoId: evidencia.casoId,
      accion: 'ELIMINAR_EVIDENCIA',
      entidad: 'EVIDENCIA',
      entidadId: evidencia.id,
      descripcion: `Evidencia ${evidencia.nombreOriginal} eliminada del caso ${evidencia.caso.codigo}`,
      metadata: {
        tipoEvidencia: evidencia.tipoEvidencia,
        nombreOriginal: evidencia.nombreOriginal,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { id: evidencia.id };
  }
}
