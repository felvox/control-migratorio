import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { obtenerIpCliente } from '../../common/utils/client-ip.util';
import { QueryReportesDto } from './dto/query-reportes.dto';
import { ReportesService } from './reportes.service';

type TipoReporteRequest =
  | 'casos-creados'
  | 'casos-carabineros'
  | 'casos-pdi'
  | 'casos-cerrados'
  | 'casos-operativos'
  | 'tiempos-sla'
  | undefined;

type TipoReporteNormalizado =
  | 'casos-creados'
  | 'casos-carabineros'
  | 'casos-pdi'
  | 'casos-cerrados';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('preview')
  async preview(
    @Query('tipo') tipo: TipoReporteRequest,
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
  ) {
    const tipoNormalizado = this.normalizarTipoReporte(tipo);
    return this.reportesService.obtenerVistaPrevia(tipoNormalizado, query, user);
  }

  @Get('casos-creados/excel')
  async casosCreadosExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-creados-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos-creados/pdf')
  async casosCreadosPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-creados-${Date.now()}.pdf`, buffer);
  }

  @Get('casos-carabineros/excel')
  async casosCarabinerosExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCarabinerosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-carabineros-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos-carabineros/pdf')
  async casosCarabinerosPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCarabinerosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-carabineros-${Date.now()}.pdf`, buffer);
  }

  @Get('casos-pdi/excel')
  async casosPdiExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosPdiExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-pdi-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos-pdi/pdf')
  async casosPdiPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosPdiPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-pdi-${Date.now()}.pdf`, buffer);
  }

  @Get('casos-cerrados/excel')
  async casosCerradosExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCerradosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-cerrados-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos-cerrados/pdf')
  async casosCerradosPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCerradosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-cerrados-${Date.now()}.pdf`, buffer);
  }

  @Get('eventos-seguridad/excel')
  async eventosSeguridadExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarEventosSeguridadExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-eventos-seguridad-${Date.now()}.xlsx`, buffer);
  }

  @Get('eventos-seguridad/pdf')
  async eventosSeguridadPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarEventosSeguridadPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-eventos-seguridad-${Date.now()}.pdf`, buffer);
  }

  @Get('actividad-usuarios/excel')
  async actividadUsuariosExcel(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarActividadUsuariosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-actividad-usuarios-${Date.now()}.xlsx`, buffer);
  }

  @Get('actividad-usuarios/pdf')
  async actividadUsuariosPdf(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarActividadUsuariosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-actividad-usuarios-${Date.now()}.pdf`, buffer);
  }

  // Compatibilidad con endpoints previos
  @Get('casos-operativos/excel')
  async casosOperativosExcelLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-operativos-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos-operativos/pdf')
  async casosOperativosPdfLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-operativos-${Date.now()}.pdf`, buffer);
  }

  @Get('tiempos-sla/excel')
  async tiemposSlaExcelLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosPdiExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-tiempos-sla-${Date.now()}.xlsx`, buffer);
  }

  @Get('tiempos-sla/pdf')
  async tiemposSlaPdfLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosPdiPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-tiempos-sla-${Date.now()}.pdf`, buffer);
  }

  @Get('casos/excel')
  async casosExcelLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosExcel(
      query,
      user,
      this.meta(req),
    );
    this.enviarExcel(res, `reporte-casos-${Date.now()}.xlsx`, buffer);
  }

  @Get('casos/pdf')
  async casosPdfLegacy(
    @Query() query: QueryReportesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.exportarCasosCreadosPdf(
      query,
      user,
      this.meta(req),
    );
    this.enviarPdf(res, `reporte-casos-${Date.now()}.pdf`, buffer);
  }

  private normalizarTipoReporte(tipo: TipoReporteRequest): TipoReporteNormalizado {
    if (
      tipo === 'casos-creados' ||
      tipo === 'casos-carabineros' ||
      tipo === 'casos-pdi' ||
      tipo === 'casos-cerrados'
    ) {
      return tipo;
    }

    if (tipo === 'tiempos-sla') {
      return 'casos-pdi';
    }

    return 'casos-creados';
  }

  private meta(req: Request): { ip?: string; userAgent?: string } {
    return {
      ip: obtenerIpCliente(req),
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    };
  }

  private enviarExcel(res: Response, filename: string, buffer: Buffer): void {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  private enviarPdf(res: Response, filename: string, buffer: Buffer): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
