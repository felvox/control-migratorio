import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  EstadoCaso,
  InstitucionDerivacion,
  Jaf,
  Prisma,
  Role,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { QueryReportesDto } from './dto/query-reportes.dto';

const ACCIONES_SEGURIDAD = [
  'LOGIN_FALLIDO',
  'LOGIN_BLOQUEADO_TEMPORAL',
  'LOGIN_IP_NUEVA',
];

const ACCIONES_TIMELINE = [
  'ENVIAR_CASO_DERIVACION',
  'RECEPCIONAR_CASO_CARABINEROS',
  'DERIVAR_CASO_A_PDI',
  'RECEPCIONAR_CASO_PDI',
  'CERRAR_CASO_PDI',
];

type MetaRequest = { ip?: string; userAgent?: string };
type TipoReporteCasos =
  | 'casos-creados'
  | 'casos-carabineros'
  | 'casos-pdi'
  | 'casos-cerrados';

interface TimelineCaso {
  enviarDerivacion?: Date;
  recepcionarCarabineros?: Date;
  derivarPdi?: Date;
  recepcionarPdi?: Date;
  cerrarPdi?: Date;
  recepcionaCarabinerosPor?: string;
  recepcionaPdiPor?: string;
}

interface PdfTableColumn {
  header: string;
  key: string;
  weight: number;
}

interface PdfTableOptions {
  size?: PDFKit.PDFDocumentOptions['size'];
  layout?: PDFKit.PDFDocumentOptions['layout'];
  margin?: number;
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async exportarCasosOperativosExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoExcel('casos-creados', query, user, meta);
  }

  async exportarCasosOperativosPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoPdf('casos-creados', query, user, meta);
  }

  async exportarCasosCreadosExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoExcel('casos-creados', query, user, meta);
  }

  async exportarCasosCreadosPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoPdf('casos-creados', query, user, meta);
  }

  async exportarCasosCarabinerosExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoExcel('casos-carabineros', query, user, meta);
  }

  async exportarCasosCarabinerosPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoPdf('casos-carabineros', query, user, meta);
  }

  async exportarCasosPdiExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoExcel('casos-pdi', query, user, meta);
  }

  async exportarCasosPdiPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    return this.exportarCasosPorTipoPdf('casos-pdi', query, user, meta);
  }

  private async exportarCasosPorTipoExcel(
    tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>,
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosPorTipoReporte(tipo, query, user);
    const rows = casos.map((caso) => {
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ??
        caso.personas[0];
      return {
        codigo: caso.codigo,
        fechaCreacion: this.formatearFecha(caso.creadoAt),
        jaf: this.etiquetaJaf(caso.jaf),
        tipoControl: this.etiquetaTipoControl(caso.tipoControl),
        lugar: caso.lugar,
        estado: this.etiquetaEstado(caso.estado),
        institucion: this.etiquetaInstitucion(caso.institucionDerivacion),
        menores: caso.existenMenores ? 'Sí' : 'No',
        creadoPor: caso.creadoPor?.nombreCompleto ?? '-',
        actualizadoAt: this.formatearFecha(caso.actualizadoAt),
        actualizadoPor: caso.actualizadoPor?.nombreCompleto ?? '-',
        principal: principal
          ? `${principal.nombres} ${principal.apellidos}`.trim()
          : '-',
      };
    });

    const etiquetaTipo = this.etiquetaTipoReporte(tipo);
    const accionTipo = this.codigoAccionTipoReporte(tipo);
    const buffer = await this.generarExcel(etiquetaTipo, [
      { header: 'Código', key: 'codigo', width: 20 },
      { header: 'Fecha creación', key: 'fechaCreacion', width: 20 },
      { header: 'JAF', key: 'jaf', width: 24 },
      { header: 'Tipo control', key: 'tipoControl', width: 14 },
      { header: 'Lugar', key: 'lugar', width: 18 },
      { header: 'Estado', key: 'estado', width: 26 },
      { header: 'Institución actual', key: 'institucion', width: 22 },
      { header: 'Con menores', key: 'menores', width: 12 },
      { header: 'Creado por', key: 'creadoPor', width: 30 },
      { header: 'Última actualización', key: 'actualizadoAt', width: 22 },
      { header: 'Actualizado por', key: 'actualizadoPor', width: 30 },
      { header: 'Persona principal', key: 'principal', width: 30 },
    ], rows);

    await this.registrarAuditoriaExportacion(
      user,
      `EXPORTAR_REPORTE_${accionTipo}_EXCEL`,
      `Reporte Excel de ${etiquetaTipo.toLowerCase()} generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  private async exportarCasosPorTipoPdf(
    tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>,
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosPorTipoReporte(tipo, query, user);
    const rows = casos.map((caso) => {
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ??
        caso.personas[0];
      return {
        codigo: caso.codigo,
        fecha: this.formatearFecha(caso.creadoAt),
        jaf: this.etiquetaJaf(caso.jaf),
        estado: this.etiquetaEstado(caso.estado),
        institucion: this.etiquetaInstitucion(caso.institucionDerivacion),
        tipoControl: this.etiquetaTipoControl(caso.tipoControl),
        menores: caso.existenMenores ? 'Sí' : 'No',
        principal: principal
          ? `${principal.nombres} ${principal.apellidos}`.trim()
          : '-',
        lugar: caso.lugar,
      };
    });

    const etiquetaTipo = this.etiquetaTipoReporte(tipo);
    const accionTipo = this.codigoAccionTipoReporte(tipo);
    const columns: PdfTableColumn[] = [
      { header: 'Código', key: 'codigo', weight: 14 },
      { header: 'Fecha', key: 'fecha', weight: 13 },
      { header: 'JAF', key: 'jaf', weight: 11 },
      { header: 'Estado', key: 'estado', weight: 13 },
      { header: 'Institución', key: 'institucion', weight: 10 },
      { header: 'Tipo control', key: 'tipoControl', weight: 10 },
      { header: 'Con menores', key: 'menores', weight: 8 },
      { header: 'Persona principal', key: 'principal', weight: 14 },
      { header: 'Lugar', key: 'lugar', weight: 7 },
    ];
    const buffer = await this.generarPdfTabla(
      `Reporte de ${etiquetaTipo}`,
      columns,
      rows,
      `Total registros: ${rows.length}`,
    );

    await this.registrarAuditoriaExportacion(
      user,
      `EXPORTAR_REPORTE_${accionTipo}_PDF`,
      `Reporte PDF de ${etiquetaTipo.toLowerCase()} generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarTiemposSlaExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosOperativos(query, user);
    const timeline = await this.obtenerTimelinePorCasos(casos.map((c) => c.id));
    const slaHoras = query.slaHoras ?? 72;

    const rows = casos.map((caso) => {
      const hitos = timeline.get(caso.id) ?? {};
      const tiempoEjercitoCarab = this.diffMs(
        hitos.enviarDerivacion,
        hitos.recepcionarCarabineros,
      );
      const tiempoCarabPdi = this.diffMs(
        hitos.recepcionarCarabineros,
        hitos.derivarPdi,
      );
      const tiempoPdiCierre = this.diffMs(
        hitos.recepcionarPdi,
        hitos.cerrarPdi,
      );
      const tiempoTotal = this.diffMs(caso.creadoAt, hitos.cerrarPdi);

      return {
        codigo: caso.codigo,
        jaf: this.etiquetaJaf(caso.jaf),
        fechaCreacion: this.formatearFecha(caso.creadoAt),
        fechaEnvioCarabineros: this.formatearFecha(hitos.enviarDerivacion),
        fechaRecepcionCarabineros: this.formatearFecha(
          hitos.recepcionarCarabineros,
        ),
        fechaDerivacionPdi: this.formatearFecha(hitos.derivarPdi),
        fechaRecepcionPdi: this.formatearFecha(hitos.recepcionarPdi),
        fechaCierre: this.formatearFecha(hitos.cerrarPdi),
        tiempoEjercitoCarabineros: this.formatearDuracion(tiempoEjercitoCarab),
        tiempoCarabinerosPdi: this.formatearDuracion(tiempoCarabPdi),
        tiempoPdiCierre: this.formatearDuracion(tiempoPdiCierre),
        tiempoTotal: this.formatearDuracion(tiempoTotal),
        cumpleSla:
          tiempoTotal !== null && tiempoTotal <= slaHoras * 60 * 60 * 1000
            ? 'Sí'
            : 'No',
      };
    });

    const buffer = await this.generarExcel('Tiempos y SLA', [
      { header: 'Código', key: 'codigo', width: 20 },
      { header: 'JAF', key: 'jaf', width: 22 },
      { header: 'Fecha creación', key: 'fechaCreacion', width: 20 },
      { header: 'Envío a Carabineros', key: 'fechaEnvioCarabineros', width: 22 },
      {
        header: 'Recepción Carabineros',
        key: 'fechaRecepcionCarabineros',
        width: 22,
      },
      { header: 'Derivación a PDI', key: 'fechaDerivacionPdi', width: 20 },
      { header: 'Recepción PDI', key: 'fechaRecepcionPdi', width: 20 },
      { header: 'Fecha cierre', key: 'fechaCierre', width: 20 },
      {
        header: 'Tiempo Ejército -> Carabineros',
        key: 'tiempoEjercitoCarabineros',
        width: 24,
      },
      {
        header: 'Tiempo Carabineros -> PDI',
        key: 'tiempoCarabinerosPdi',
        width: 24,
      },
      { header: 'Tiempo PDI -> Cierre', key: 'tiempoPdiCierre', width: 22 },
      { header: 'Tiempo total', key: 'tiempoTotal', width: 18 },
      { header: `Cumple SLA (${slaHoras}h)`, key: 'cumpleSla', width: 16 },
    ], rows);

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_TIEMPOS_SLA_EXCEL',
      `Reporte Excel de tiempos y SLA generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarTiemposSlaPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosOperativos(query, user);
    const timeline = await this.obtenerTimelinePorCasos(casos.map((c) => c.id));
    const slaHoras = query.slaHoras ?? 72;

    const rows = casos.map((caso) => {
      const hitos = timeline.get(caso.id) ?? {};
      const tiempoTotalMs = this.diffMs(caso.creadoAt, hitos.cerrarPdi);
      return `${caso.codigo} | ${this.etiquetaJaf(caso.jaf)} | Total: ${this.formatearDuracion(tiempoTotalMs)} | SLA ${slaHoras}h: ${
        tiempoTotalMs !== null && tiempoTotalMs <= slaHoras * 60 * 60 * 1000
          ? 'Sí'
          : 'No'
      }`;
    });

    const buffer = await this.generarPdfListado(
      'Reporte de Tiempos y SLA',
      rows,
      `Total registros: ${rows.length}`,
    );

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_TIEMPOS_SLA_PDF',
      `Reporte PDF de tiempos y SLA generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarCasosCerradosExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosCerrados(query, user);
    const timeline = await this.obtenerTimelinePorCasos(casos.map((c) => c.id));

    const rows = casos.map((caso) => {
      const hitos = timeline.get(caso.id) ?? {};
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ??
        caso.personas[0];
      return {
        codigo: caso.codigo,
        jaf: this.etiquetaJaf(caso.jaf),
        principal: principal
          ? `${principal.nombres} ${principal.apellidos}`.trim()
          : '-',
        fechaCierre: this.formatearFecha(hitos.cerrarPdi ?? caso.actualizadoAt),
        resultadoPdi: caso.pdiResultado ?? '-',
        observacionesCierre: caso.pdiObservacionesCierre ?? '-',
        creadoPor: caso.creadoPor?.nombreCompleto ?? '-',
        recepcionCarabinerosPor: hitos.recepcionaCarabinerosPor ?? '-',
        recepcionPdiPor: hitos.recepcionaPdiPor ?? '-',
        evidenciasEjercito: this.contarEvidenciasPorRol(caso, [
          Role.ADMINISTRADOR,
          Role.OPERADOR,
        ]),
        evidenciasCarabineros: this.contarEvidenciasPorRol(caso, [
          Role.CARABINEROS,
        ]),
        evidenciasPdi: this.contarEvidenciasPorRol(caso, [Role.PDI]),
      };
    });

    const buffer = await this.generarExcel('Casos cerrados', [
      { header: 'Código', key: 'codigo', width: 20 },
      { header: 'JAF', key: 'jaf', width: 22 },
      { header: 'Persona principal', key: 'principal', width: 30 },
      { header: 'Fecha cierre', key: 'fechaCierre', width: 20 },
      { header: 'Resultado PDI', key: 'resultadoPdi', width: 24 },
      { header: 'Observación de cierre', key: 'observacionesCierre', width: 40 },
      { header: 'Creado por', key: 'creadoPor', width: 30 },
      {
        header: 'Recepción Carabineros',
        key: 'recepcionCarabinerosPor',
        width: 28,
      },
      { header: 'Recepción PDI', key: 'recepcionPdiPor', width: 28 },
      { header: 'Evidencias Ejército', key: 'evidenciasEjercito', width: 20 },
      {
        header: 'Evidencias Carabineros',
        key: 'evidenciasCarabineros',
        width: 20,
      },
      { header: 'Evidencias PDI', key: 'evidenciasPdi', width: 16 },
    ], rows);

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_CASOS_CERRADOS_EXCEL',
      `Reporte Excel de casos cerrados generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarCasosCerradosPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const casos = await this.obtenerCasosCerrados(query, user);
    const rows = casos.map((caso) => {
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ??
        caso.personas[0];
      return {
        codigo: caso.codigo,
        fechaCierre: this.formatearFecha(caso.actualizadoAt),
        jaf: this.etiquetaJaf(caso.jaf),
        principal: principal
          ? `${principal.nombres} ${principal.apellidos}`.trim()
          : '-',
        resolucionAdoptada: this.etiquetaResultadoPdi(caso.pdiResultado),
        observacionCierre: caso.pdiObservacionesCierre ?? '-',
      };
    });
    const columns: PdfTableColumn[] = [
      { header: 'Código', key: 'codigo', weight: 11 },
      { header: 'Fecha cierre', key: 'fechaCierre', weight: 11 },
      { header: 'JAF', key: 'jaf', weight: 10 },
      { header: 'Persona principal', key: 'principal', weight: 16 },
      { header: 'Resolución adoptada', key: 'resolucionAdoptada', weight: 26 },
      { header: 'Observación de cierre', key: 'observacionCierre', weight: 26 },
    ];

    const buffer = await this.generarPdfTabla(
      'Reporte de Casos Cerrados',
      columns,
      rows,
      `Total registros: ${rows.length}`,
      {
        size: [612, 936],
        layout: 'landscape',
        margin: 24,
      },
    );

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_CASOS_CERRADOS_PDF',
      `Reporte PDF de casos cerrados generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarEventosSeguridadExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const items = await this.obtenerEventosSeguridad(query, user);
    const rows = items.map((item) => ({
      fecha: this.formatearFecha(item.fechaHora),
      evento: this.etiquetaEventoSeguridad(item.accion),
      usuario: item.usuario?.nombreCompleto ?? '-',
      run: this.obtenerRunDesdeMetadata(item.metadata),
      rol: item.usuario ? this.etiquetaRol(item.usuario.rol) : '-',
      jaf: item.usuario?.jaf ? this.etiquetaJaf(item.usuario.jaf) : '-',
      ip: this.normalizarIpVisible(item.ip),
      userAgent: this.recortarTexto(item.userAgent ?? '-', 60),
      descripcion: item.descripcion ?? '-',
      estadoRevision: item.seguridadRevisadoAt ? 'Revisado' : 'Pendiente',
      revisadoPor: item.seguridadRevisadoPor?.nombreCompleto ?? '-',
      fechaRevision: this.formatearFecha(item.seguridadRevisadoAt),
    }));

    const buffer = await this.generarExcel('Eventos de seguridad', [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Tipo evento', key: 'evento', width: 28 },
      { header: 'Usuario', key: 'usuario', width: 30 },
      { header: 'RUN', key: 'run', width: 18 },
      { header: 'Rol', key: 'rol', width: 18 },
      { header: 'JAF', key: 'jaf', width: 24 },
      { header: 'IP', key: 'ip', width: 18 },
      { header: 'User-Agent', key: 'userAgent', width: 40 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Estado revisión', key: 'estadoRevision', width: 18 },
      { header: 'Revisado por', key: 'revisadoPor', width: 30 },
      { header: 'Fecha revisión', key: 'fechaRevision', width: 20 },
    ], rows);

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_EVENTOS_SEGURIDAD_EXCEL',
      `Reporte Excel de eventos de seguridad generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarEventosSeguridadPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const items = await this.obtenerEventosSeguridad(query, user);
    const rows = items.map(
      (item) =>
        `${this.formatearFecha(item.fechaHora)} | ${this.etiquetaEventoSeguridad(
          item.accion,
        )} | ${item.usuario?.nombreCompleto ?? '-'} | IP ${this.normalizarIpVisible(item.ip)}`,
    );

    const buffer = await this.generarPdfListado(
      'Reporte de Eventos de Seguridad',
      rows,
      `Total registros: ${rows.length}`,
    );

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_EVENTOS_SEGURIDAD_PDF',
      `Reporte PDF de eventos de seguridad generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarActividadUsuariosExcel(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const items = await this.obtenerActividadUsuarios(query, user);
    const rows = items.map((item) => ({
      fecha: this.formatearFecha(item.fechaHora),
      usuario: item.usuario?.nombreCompleto ?? '-',
      rol: item.usuario ? this.etiquetaRol(item.usuario.rol) : '-',
      jaf:
        item.usuario?.jaf
          ? this.etiquetaJaf(item.usuario.jaf)
          : item.caso?.jaf
            ? this.etiquetaJaf(item.caso.jaf)
            : '-',
      accion: item.accion,
      descripcion: item.descripcion ?? '-',
      codigoCaso: item.caso?.codigo ?? '-',
      personaInvolucrada: this.personaPrincipalTexto(item.caso?.personas ?? []),
      ip: this.normalizarIpVisible(item.ip),
    }));

    const buffer = await this.generarExcel('Actividad de usuarios', [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Usuario', key: 'usuario', width: 30 },
      { header: 'Rol', key: 'rol', width: 18 },
      { header: 'JAF', key: 'jaf', width: 24 },
      { header: 'Acción', key: 'accion', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 42 },
      { header: 'Caso', key: 'codigoCaso', width: 20 },
      { header: 'Persona involucrada', key: 'personaInvolucrada', width: 30 },
      { header: 'IP', key: 'ip', width: 18 },
    ], rows);

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_ACTIVIDAD_USUARIOS_EXCEL',
      `Reporte Excel de actividad de usuarios generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async exportarActividadUsuariosPdf(
    query: QueryReportesDto,
    user: AuthUser,
    meta?: MetaRequest,
  ) {
    const items = await this.obtenerActividadUsuarios(query, user);
    const rows = items.map(
      (item) =>
        `${this.formatearFecha(item.fechaHora)} | ${item.usuario?.nombreCompleto ?? '-'} | ${item.accion} | ${
          item.descripcion ?? '-'
        }`,
    );

    const buffer = await this.generarPdfListado(
      'Reporte de Actividad de Usuarios',
      rows,
      `Total registros: ${rows.length}`,
    );

    await this.registrarAuditoriaExportacion(
      user,
      'EXPORTAR_REPORTE_ACTIVIDAD_USUARIOS_PDF',
      `Reporte PDF de actividad de usuarios generado (${rows.length} registros)`,
      query,
      meta,
    );

    return buffer;
  }

  async obtenerVistaPrevia(
    tipo: TipoReporteCasos,
    query: QueryReportesDto,
    user: AuthUser,
  ) {
    if (tipo === 'casos-cerrados') {
      const casos = await this.obtenerCasosCerrados(query, user);
      const rows = casos.slice(0, 30).map((caso) => [
        caso.codigo,
        this.etiquetaJaf(caso.jaf),
        this.personaPrincipalTexto(caso.personas),
        caso.pdiResultado ?? '-',
        this.formatearFecha(caso.actualizadoAt),
      ]);

      return {
        tipo,
        total: casos.length,
        columnas: ['Código', 'JAF', 'Persona principal', 'Resultado PDI', 'Fecha cierre'],
        filas: rows,
      };
    }

    const casos = await this.obtenerCasosPorTipoReporte(tipo, query, user);
    const rows = casos.slice(0, 30).map((caso) => {
      const principal =
        caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ??
        caso.personas[0];
      return [
        caso.codigo,
        this.formatearFecha(caso.creadoAt),
        this.etiquetaJaf(caso.jaf),
        this.etiquetaEstado(caso.estado),
        principal
          ? `${principal.nombres} ${principal.apellidos}`.trim()
          : '-',
      ];
    });

    return {
      tipo,
      total: casos.length,
      columnas: ['Código', 'Fecha', 'JAF', 'Estado', 'Persona principal'],
      filas: rows,
    };
  }

  private async obtenerCasosPorTipoReporte(
    tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>,
    query: QueryReportesDto,
    user: AuthUser,
  ) {
    const queryNormalizada = this.aplicarTipoReporteEnQuery(tipo, query);
    return this.obtenerCasosOperativos(queryNormalizada, user);
  }

  private aplicarTipoReporteEnQuery(
    tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>,
    query: QueryReportesDto,
  ): QueryReportesDto {
    const base: QueryReportesDto = {
      ...query,
      estado: undefined,
      institucion: undefined,
      resultadoPdi: undefined,
      fechaCierreDesde: undefined,
      fechaCierreHasta: undefined,
      slaHoras: undefined,
    };

    if (tipo === 'casos-carabineros') {
      base.estado = EstadoCaso.DERIVADO_CARABINEROS;
      base.institucion = InstitucionDerivacion.CARABINEROS;
    }

    if (tipo === 'casos-pdi') {
      base.estado = EstadoCaso.DERIVADO_PDI;
      base.institucion = InstitucionDerivacion.PDI;
    }

    return base;
  }

  private etiquetaTipoReporte(tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>): string {
    if (tipo === 'casos-creados') {
      return 'Casos creados';
    }
    if (tipo === 'casos-carabineros') {
      return 'Casos Carabineros';
    }
    return 'Casos PDI';
  }

  private codigoAccionTipoReporte(
    tipo: Exclude<TipoReporteCasos, 'casos-cerrados'>,
  ): string {
    if (tipo === 'casos-creados') {
      return 'CASOS_CREADOS';
    }
    if (tipo === 'casos-carabineros') {
      return 'CASOS_CARABINEROS';
    }
    return 'CASOS_PDI';
  }

  private async obtenerCasosOperativos(query: QueryReportesDto, user: AuthUser) {
    const where = this.construirWhereCasos(query, user, false);
    return this.prisma.caso.findMany({
      where,
      orderBy: { creadoAt: 'desc' },
      include: {
        creadoPor: { select: { nombreCompleto: true } },
        actualizadoPor: { select: { nombreCompleto: true } },
        personas: {
          select: {
            tipoPersona: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      take: 5000,
    });
  }

  private async obtenerCasosCerrados(query: QueryReportesDto, user: AuthUser) {
    const where = this.construirWhereCasos(query, user, true);
    const casos = await this.prisma.caso.findMany({
      where,
      orderBy: { actualizadoAt: 'desc' },
      include: {
        creadoPor: { select: { nombreCompleto: true } },
        personas: {
          select: {
            tipoPersona: true,
            nombres: true,
            apellidos: true,
            edad: true,
          },
        },
        evidencias: {
          select: {
            creadoPor: {
              select: {
                rol: true,
              },
            },
          },
        },
      },
      take: 5000,
    });

    if (!query.fechaCierreDesde && !query.fechaCierreHasta) {
      return casos;
    }

    const timeline = await this.obtenerTimelinePorCasos(casos.map((c) => c.id));
    const desde = query.fechaCierreDesde ? new Date(query.fechaCierreDesde) : null;
    const hasta = query.fechaCierreHasta ? new Date(query.fechaCierreHasta) : null;

    return casos.filter((caso) => {
      const fechaCierre = timeline.get(caso.id)?.cerrarPdi ?? caso.actualizadoAt;
      if (desde && fechaCierre < desde) {
        return false;
      }
      if (hasta && fechaCierre > hasta) {
        return false;
      }
      return true;
    });
  }

  private construirWhereCasos(
    query: QueryReportesDto,
    user: AuthUser,
    soloCerrados: boolean,
  ): Prisma.CasoWhereInput {
    const esAdminOperativo = user.role === Role.ADMINISTRADOR && !user.esMaster;
    if (esAdminOperativo && !user.jaf) {
      throw new ForbiddenException(
        'Administrador operativo sin JAF asignada. Contacte al Administrador Master.',
      );
    }

    return {
      eliminadoAt: null,
      jaf: esAdminOperativo ? (user.jaf ?? undefined) : query.jaf,
      estado: soloCerrados ? EstadoCaso.CERRADO : query.estado,
      tipoControl: query.tipoControl,
      institucionDerivacion: query.institucion,
      creadoPorId: query.usuarioId,
      lugar: query.ubicacion
        ? {
            contains: query.ubicacion,
            mode: 'insensitive',
          }
        : undefined,
      existenMenores:
        typeof query.conMenores === 'boolean' ? query.conMenores : undefined,
      fechaHoraProcedimiento:
        query.fechaDesde || query.fechaHasta
          ? {
              gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
              lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
            }
          : undefined,
      pdiResultado: query.resultadoPdi
        ? {
            contains: query.resultadoPdi,
            mode: 'insensitive',
          }
        : undefined,
    };
  }

  private async obtenerTimelinePorCasos(casoIds: string[]) {
    const timeline = new Map<string, TimelineCaso>();
    if (!casoIds.length) {
      return timeline;
    }

    const eventos = await this.prisma.auditoria.findMany({
      where: {
        casoId: {
          in: casoIds,
        },
        accion: {
          in: ACCIONES_TIMELINE,
        },
      },
      orderBy: {
        fechaHora: 'asc',
      },
      select: {
        casoId: true,
        accion: true,
        fechaHora: true,
        usuario: {
          select: {
            nombreCompleto: true,
          },
        },
      },
      take: 20000,
    });

    for (const evento of eventos) {
      if (!evento.casoId) {
        continue;
      }

      const current = timeline.get(evento.casoId) ?? {};

      if (evento.accion === 'ENVIAR_CASO_DERIVACION' && !current.enviarDerivacion) {
        current.enviarDerivacion = evento.fechaHora;
      }
      if (
        evento.accion === 'RECEPCIONAR_CASO_CARABINEROS' &&
        !current.recepcionarCarabineros
      ) {
        current.recepcionarCarabineros = evento.fechaHora;
        current.recepcionaCarabinerosPor = evento.usuario?.nombreCompleto ?? '-';
      }
      if (evento.accion === 'DERIVAR_CASO_A_PDI' && !current.derivarPdi) {
        current.derivarPdi = evento.fechaHora;
      }
      if (evento.accion === 'RECEPCIONAR_CASO_PDI' && !current.recepcionarPdi) {
        current.recepcionarPdi = evento.fechaHora;
        current.recepcionaPdiPor = evento.usuario?.nombreCompleto ?? '-';
      }
      if (evento.accion === 'CERRAR_CASO_PDI') {
        current.cerrarPdi = evento.fechaHora;
      }

      timeline.set(evento.casoId, current);
    }

    return timeline;
  }

  private async obtenerEventosSeguridad(query: QueryReportesDto, user: AuthUser) {
    const esAdminOperativo = user.role === Role.ADMINISTRADOR && !user.esMaster;
    const jafFiltro = esAdminOperativo ? user.jaf : query.jaf;

    const whereAnd: Prisma.AuditoriaWhereInput[] = [
      {
        accion: {
          in: query.tipoEvento ? [query.tipoEvento] : ACCIONES_SEGURIDAD,
        },
      },
    ];

    if (query.fechaDesde || query.fechaHasta) {
      whereAnd.push({
        fechaHora: {
          gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
          lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
        },
      });
    }

    if (query.usuarioId) {
      whereAnd.push({ usuarioId: query.usuarioId });
    }

    if (jafFiltro) {
      whereAnd.push({
        usuario: {
          jaf: jafFiltro,
        },
      });
    }

    if (query.estadoRevision === 'PENDIENTES') {
      whereAnd.push({ seguridadRevisadoAt: null });
    }
    if (query.estadoRevision === 'REVISADOS') {
      whereAnd.push({
        seguridadRevisadoAt: {
          not: null,
        },
      });
    }

    const where: Prisma.AuditoriaWhereInput = { AND: whereAnd };

    return this.prisma.auditoria.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            nombreCompleto: true,
            rol: true,
            jaf: true,
          },
        },
        seguridadRevisadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
          },
        },
      },
      orderBy: {
        fechaHora: 'desc',
      },
      take: 5000,
    });
  }

  private async obtenerActividadUsuarios(query: QueryReportesDto, user: AuthUser) {
    const esAdminOperativo = user.role === Role.ADMINISTRADOR && !user.esMaster;
    const jafFiltro = esAdminOperativo ? user.jaf : query.jaf;

    const whereAnd: Prisma.AuditoriaWhereInput[] = [];

    if (query.fechaDesde || query.fechaHasta) {
      whereAnd.push({
        fechaHora: {
          gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
          lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
        },
      });
    }

    if (query.usuarioId) {
      whereAnd.push({ usuarioId: query.usuarioId });
    }

    if (query.rol) {
      whereAnd.push({
        usuario: {
          rol: query.rol,
        },
      });
    }

    if (query.accion) {
      whereAnd.push({
        accion: query.accion,
      });
    }

    if (jafFiltro) {
      whereAnd.push({
        OR: [
          {
            usuario: {
              jaf: jafFiltro,
            },
          },
          {
            caso: {
              jaf: jafFiltro,
            },
          },
        ],
      });
    }

    const where: Prisma.AuditoriaWhereInput =
      whereAnd.length > 0 ? { AND: whereAnd } : {};

    return this.prisma.auditoria.findMany({
      where,
      include: {
        usuario: {
          select: {
            nombreCompleto: true,
            rol: true,
            jaf: true,
          },
        },
        caso: {
          select: {
            codigo: true,
            jaf: true,
            personas: {
              select: {
                tipoPersona: true,
                nombres: true,
                apellidos: true,
                edad: true,
              },
              orderBy: {
                creadoAt: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        fechaHora: 'desc',
      },
      take: 5000,
    });
  }

  private contarEvidenciasPorRol(
    caso: { evidencias: Array<{ creadoPor: { rol: Role } }> },
    roles: Role[],
  ): number {
    const setRoles = new Set(roles);
    return caso.evidencias.filter((e) => setRoles.has(e.creadoPor.rol)).length;
  }

  private async generarExcel(
    title: string,
    columns: Array<{ header: string; key: string; width: number }>,
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title);
    sheet.columns = columns;
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async generarPdfListado(
    title: string,
    rows: string[],
    resumen: string,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));

      doc.fontSize(14).text(title, { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).text(`Generado: ${new Date().toLocaleString('es-CL')}`);
      doc.text(resumen);
      doc.moveDown(0.7);

      if (!rows.length) {
        doc.fontSize(10).text('No hay registros para los filtros aplicados.');
      }

      rows.forEach((row) => {
        doc.fontSize(9).text(row);
        doc.moveDown(0.35);
        if (doc.y > 760) {
          doc.addPage();
        }
      });

      doc.end();
    });
  }

  private async generarPdfTabla(
    title: string,
    columns: PdfTableColumn[],
    rows: Record<string, unknown>[],
    resumen: string,
    options?: PdfTableOptions,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const margin = options?.margin ?? 26;
      const pageSize = options?.size ?? 'A4';
      const pageLayout = options?.layout ?? 'landscape';
      const doc = new PDFDocument({
        size: pageSize,
        layout: pageLayout,
        margin,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));

      const totalWeight = columns.reduce((acc, col) => acc + col.weight, 0);
      const tableWidth = doc.page.width - margin * 2;
      const columnWidths = columns.map((col) => (tableWidth * col.weight) / totalWeight);
      const rowPaddingX = 5;
      const rowPaddingY = 4;
      const minRowHeight = 20;
      const bottomLimit = () => doc.page.height - margin;
      let y = margin;

      const drawTitle = () => {
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f2f3f').text(title, margin, y);
        y = doc.y + 4;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#4a5f74')
          .text(`Generado: ${new Date().toLocaleString('es-CL')}`, margin, y);
        y = doc.y + 2;
        doc.text(resumen, margin, y);
        y = doc.y + 8;
      };

      const drawRow = (values: string[], isHeader = false): void => {
        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
        doc.fontSize(8.5);

        const heights = values.map((value, index) => {
          const text = value && value.trim().length > 0 ? value : '-';
          return doc.heightOfString(text, {
            width: Math.max(10, columnWidths[index]! - rowPaddingX * 2),
            align: 'left',
          });
        });
        const rowHeight = Math.max(minRowHeight, Math.max(...heights) + rowPaddingY * 2);

        if (y + rowHeight > bottomLimit()) {
          doc.addPage({
            size: pageSize,
            layout: pageLayout,
            margin,
          });
          y = margin;
          drawTitle();
          drawRow(columns.map((col) => col.header), true);
        }

        let x = margin;
        values.forEach((rawValue, index) => {
          const value = rawValue && rawValue.trim().length > 0 ? rawValue : '-';
          const width = columnWidths[index]!;

          if (isHeader) {
            doc.save();
            doc.rect(x, y, width, rowHeight).fill('#eef3f8');
            doc.restore();
          }

          doc.rect(x, y, width, rowHeight).lineWidth(0.7).strokeColor('#c3cfdd').stroke();
          doc
            .fillColor(isHeader ? '#2a3b4f' : '#1f2e3d')
            .text(value, x + rowPaddingX, y + rowPaddingY, {
              width: Math.max(10, width - rowPaddingX * 2),
              align: 'left',
            });
          x += width;
        });

        y += rowHeight;
      };

      drawTitle();
      drawRow(columns.map((col) => col.header), true);

      if (!rows.length) {
        const emptyRow = columns.map((_, index) =>
          index === 0 ? 'No hay registros para los filtros aplicados.' : '',
        );
        drawRow(emptyRow);
      } else {
        rows.forEach((row) => {
          const values = columns.map((col) => {
            const raw = row[col.key];
            return raw === null || raw === undefined ? '-' : String(raw);
          });
          drawRow(values);
        });
      }

      doc.end();
    });
  }

  private async registrarAuditoriaExportacion(
    user: AuthUser,
    accion: string,
    descripcion: string,
    query: QueryReportesDto,
    meta?: MetaRequest,
  ): Promise<void> {
    await this.auditoriaService.registrarAccion({
      usuarioId: user.id,
      accion,
      entidad: 'REPORTE',
      descripcion,
      metadata: query as unknown as Record<string, unknown>,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  private formatearFecha(fecha?: Date | string | null): string {
    if (!fecha) {
      return '-';
    }
    return new Date(fecha).toLocaleString('es-CL');
  }

  private diffMs(inicio?: Date | null, fin?: Date | null): number | null {
    if (!inicio || !fin) {
      return null;
    }
    return fin.getTime() - inicio.getTime();
  }

  private formatearDuracion(ms: number | null): string {
    if (ms === null || ms < 0) {
      return '-';
    }
    const totalMinutes = Math.floor(ms / 60000);
    const horas = Math.floor(totalMinutes / 60);
    const minutos = totalMinutes % 60;
    return `${horas}h ${String(minutos).padStart(2, '0')}m`;
  }

  private etiquetaJaf(jaf: Jaf): string {
    if (jaf === Jaf.TARAPACA) {
      return 'JAF Tarapacá';
    }
    if (jaf === Jaf.ANTOFAGASTA) {
      return 'JAF Antofagasta';
    }
    return 'JAF Arica y Parinacota';
  }

  private etiquetaTipoControl(tipo: string): string {
    if (tipo === 'INGRESO') {
      return 'Ingresando';
    }
    if (tipo === 'EGRESO') {
      return 'Egresando';
    }
    return tipo;
  }

  private etiquetaEstado(estado: EstadoCaso): string {
    if (estado === EstadoCaso.PENDIENTE) {
      return 'Pendiente';
    }
    if (estado === EstadoCaso.DERIVADO_CARABINEROS) {
      return 'Derivado a Carabineros';
    }
    if (estado === EstadoCaso.DERIVADO_PDI) {
      return 'Derivado a PDI';
    }
    return 'Cerrado';
  }

  private etiquetaInstitucion(institucion: InstitucionDerivacion): string {
    if (institucion === InstitucionDerivacion.CARABINEROS) {
      return 'Carabineros';
    }
    if (institucion === InstitucionDerivacion.PDI) {
      return 'PDI';
    }
    return 'Sin derivación';
  }

  private etiquetaResultadoPdi(resultado?: string | null): string {
    if (!resultado) {
      return '-';
    }

    if (resultado === 'RECONDUCCION') {
      return 'Reconducción';
    }
    if (resultado === 'DENUNCIA_SNM_TERRITORIO_NACIONAL') {
      return 'Denuncia al Servicio Nacional de Migraciones y permanencia en territorio nacional';
    }
    if (resultado === 'DENUNCIA_SNM_SALIDA_VOLUNTARIA') {
      return 'Denuncia al Servicio Nacional de Migraciones y salida voluntaria';
    }
    if (resultado === 'PUESTA_DISPOSICION_TRIBUNAL') {
      return 'Puesta a disposición del tribunal';
    }

    return resultado;
  }

  private etiquetaRol(rol: Role): string {
    if (rol === Role.ADMINISTRADOR) {
      return 'Administrador';
    }
    if (rol === Role.OPERADOR) {
      return 'Operador';
    }
    if (rol === Role.CONSULTA) {
      return 'Consulta';
    }
    if (rol === Role.AUDITOR) {
      return 'Auditor';
    }
    if (rol === Role.CARABINEROS) {
      return 'Carabineros';
    }
    return 'PDI';
  }

  private etiquetaEventoSeguridad(accion: string): string {
    if (accion === 'LOGIN_FALLIDO') {
      return 'Inicio de sesión fallido';
    }
    if (accion === 'LOGIN_BLOQUEADO_TEMPORAL') {
      return 'Bloqueo temporal de acceso';
    }
    if (accion === 'LOGIN_IP_NUEVA') {
      return 'Acceso desde IP no reconocida';
    }
    return accion;
  }

  private obtenerRunDesdeMetadata(metadata: Prisma.JsonValue | null): string {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return '-';
    }
    const run = (metadata as Record<string, unknown>)['run'];
    return typeof run === 'string' && run.trim().length > 0 ? run : '-';
  }

  private personaPrincipalTexto(
    personas: Array<{
      tipoPersona: string;
      nombres: string;
      apellidos: string;
      edad: number;
    }>,
  ): string {
    if (!personas.length) {
      return '-';
    }

    const principal = personas.find((p) => p.tipoPersona === 'PRINCIPAL') ?? personas[0];
    const nombre = `${principal.nombres} ${principal.apellidos}`.trim();
    if (!nombre) {
      return principal.edad >= 18 ? 'Mayor de edad' : 'Menor de edad';
    }

    return principal.edad >= 18
      ? `${nombre} (Mayor de edad)`
      : `${nombre} (Menor de edad)`;
  }

  private normalizarIpVisible(ip?: string | null): string {
    if (!ip) {
      return '-';
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    if (ip.startsWith('::ffff:')) {
      return ip.slice(7);
    }
    return ip;
  }

  private recortarTexto(value: string, max: number): string {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max - 1)}…`;
  }
}
