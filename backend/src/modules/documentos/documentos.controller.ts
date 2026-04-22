import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DocumentosService } from './documentos.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('casos/:id/documentos/pdf')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  generarActa(
    @Param('id') casoId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.documentosService.generarActaPdf(casoId, user, {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get('casos/:id/documentos')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
  listarPorCaso(@Param('id') casoId: string, @CurrentUser() user: AuthUser) {
    return this.documentosService.listarPorCaso(casoId, user);
  }

  @Get('documentos/:id/download')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
  async descargar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { documento, stream } = await this.documentosService.obtenerDescarga(
      id,
      user,
    );

    response.set({
      'Content-Type': documento.mimeType,
      'Content-Disposition': `attachment; filename="${documento.nombreOriginal}"`,
    });

    return new StreamableFile(stream);
  }
}
