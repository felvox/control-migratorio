import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { EvidenciasService } from './evidencias.service';
import { UploadEvidenciaDto } from './dto/upload-evidencia.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenciasController {
  constructor(private readonly evidenciasService: EvidenciasService) {}

  @Post('casos/:casoId/evidencias')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
    }),
  )
  subir(
    @Param('casoId') casoId: string,
    @Body() dto: UploadEvidenciaDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.evidenciasService.subirEvidencia(casoId, dto, file, user, {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get('casos/:casoId/evidencias')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
  listar(@Param('casoId') casoId: string, @CurrentUser() user: AuthUser) {
    return this.evidenciasService.listarPorCaso(casoId, user);
  }

  @Get('evidencias/:id/download')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
  async descargar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { evidencia, rutaAbsoluta } =
      await this.evidenciasService.obtenerParaDescarga(id, user);

    response.set({
      'Content-Type': evidencia.mimeType,
      'Content-Disposition': `attachment; filename="${evidencia.nombreOriginal}"`,
    });

    return new StreamableFile(createReadStream(rutaAbsoluta));
  }
}
