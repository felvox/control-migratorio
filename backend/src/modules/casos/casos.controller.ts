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
import { CasosService } from './casos.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';
import { QueryCasosDto } from './dto/query-casos.dto';
import { CambiarEstadoCasoDto } from './dto/cambiar-estado-caso.dto';

@Controller('casos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasosController {
  constructor(private readonly casosService: CasosService) {}

  @Post()
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  crear(
    @Body() dto: CreateCasoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.crear(dto, user, {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get()
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
  listar(@Query() query: QueryCasosDto, @CurrentUser() user: AuthUser) {
    return this.casosService.listar(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR, Role.CONSULTA)
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
    return this.casosService.actualizar(id, dto, user, {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Patch(':id/estado')
  @Roles(Role.ADMINISTRADOR, Role.OPERADOR)
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoCasoDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casosService.cambiarEstado(id, dto, user, {
      ip: req.ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}
