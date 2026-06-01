import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { obtenerIpCliente } from '../../common/utils/client-ip.util';
import { CasosService } from './casos.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';
import { QueryCasosDto } from './dto/query-casos.dto';
import { CambiarEstadoCasoDto } from './dto/cambiar-estado-caso.dto';
import { AddObservacionInstitucionalDto } from './dto/add-observacion-institucional.dto';
import { CerrarPdiDto } from './dto/cerrar-pdi.dto';

@Controller('casos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasosController {
  constructor(private readonly casosService: CasosService) {}

  private extraerMetaRequest(req: Request): { ip?: string; userAgent?: string } {
    return {
      ip: obtenerIpCliente(req),
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    };
  }

  @Post()
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  crear(
    @Body() dto: CreateCasoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.crear(dto, user, this.extraerMetaRequest(req));
  }

  @Get()
  @Roles(
    Role.ADMINISTRADOR,
    Role.OPERADOR,
    Role.CONSULTA,
    Role.AUDITOR,
    Role.CARABINEROS,
    Role.PDI,
  )
  listar(@Query() query: QueryCasosDto, @CurrentUser() user: AuthUser) {
    return this.casosService.listar(query, user);
  }

  @Get(':id')
  @Roles(
    Role.ADMINISTRADOR,
    Role.OPERADOR,
    Role.CONSULTA,
    Role.AUDITOR,
    Role.CARABINEROS,
    Role.PDI,
  )
  obtenerPorId(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.casosService.obtenerPorId(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateCasoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.actualizar(id, dto, user, this.extraerMetaRequest(req));
  }

  @Patch(':id/estado')
  @Roles(Role.ADMINISTRADOR)
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoCasoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.cambiarEstado(id, dto, user, this.extraerMetaRequest(req));
  }

  @Post(':id/observaciones/institucional')
  @Roles(Role.ADMINISTRADOR, Role.CARABINEROS, Role.PDI)
  agregarObservacionInstitucional(
    @Param('id') id: string,
    @Body() dto: AddObservacionInstitucionalDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.agregarObservacionInstitucional(
      id,
      dto,
      user,
      this.extraerMetaRequest(req),
    );
  }

  @Post(':id/recepcionar-carabineros')
  @Roles(Role.ADMINISTRADOR, Role.CARABINEROS)
  recepcionarCarabineros(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.recepcionarEnCarabineros(
      id,
      user,
      this.extraerMetaRequest(req),
    );
  }

  @Post(':id/enviar-derivacion')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  enviarDerivacion(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.enviarDerivacionPendiente(
      id,
      user,
      this.extraerMetaRequest(req),
    );
  }

  @Post(':id/derivar-a-pdi')
  @Roles(Role.ADMINISTRADOR, Role.CARABINEROS)
  derivarAPdi(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.derivarDesdeCarabinerosAPdi(
      id,
      user,
      this.extraerMetaRequest(req),
    );
  }

  @Post(':id/recepcionar-pdi')
  @Roles(Role.ADMINISTRADOR, Role.PDI)
  recepcionarPdi(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.recepcionarEnPdi(
      id,
      user,
      this.extraerMetaRequest(req),
    );
  }

  @Post(':id/cerrar-pdi')
  @Roles(Role.ADMINISTRADOR, Role.PDI)
  cerrarPdi(
    @Param('id') id: string,
    @Body() dto: CerrarPdiDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.cerrarEnPdi(id, dto, user, this.extraerMetaRequest(req));
  }
}
