import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get('usuarios-filtrables')
  @Roles(Role.ADMINISTRADOR)
  listarUsuariosFiltrables(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryAuditoriaDto,
  ) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    return this.auditoriaService.listarUsuariosFiltrables({
      jaf: query.jaf,
      rol: query.rol,
    });
  }

  @Get('sesiones-activas')
  @Roles(Role.ADMINISTRADOR)
  listarSesionesActivas(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryAuditoriaDto,
  ) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    return this.auditoriaService.listarSesionesActivas({
      jaf: query.jaf,
      rol: query.rol,
      usuarioId: query.usuarioId,
    });
  }

  @Get('usuarios-conexion')
  @Roles(Role.ADMINISTRADOR)
  listarUsuariosConexion(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryAuditoriaDto,
  ) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    return this.auditoriaService.listarUsuariosConexion({
      jaf: query.jaf,
      rol: query.rol,
      usuarioId: query.usuarioId,
      estadoConexion: query.estadoConexion,
    });
  }

  @Get('eventos-seguridad/resumen')
  @Roles(Role.ADMINISTRADOR)
  eventosSeguridadResumen(@CurrentUser() user: AuthUser) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    return this.auditoriaService.obtenerEventosSeguridadPendientes();
  }

  @Get('eventos-seguridad/pendientes')
  @Roles(Role.ADMINISTRADOR)
  eventosSeguridadPendientes(
    @CurrentUser() user: AuthUser,
    @Query('estado') estado?: string,
  ) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    const estadoNormalizado =
      estado === 'REVISADOS' ? 'REVISADOS' : 'PENDIENTES';

    return this.auditoriaService.listarEventosSeguridadPendientes(
      estadoNormalizado,
    );
  }

  @Post('eventos-seguridad/marcar-revisados')
  @Roles(Role.ADMINISTRADOR)
  marcarEventosSeguridadRevisados(@CurrentUser() user: AuthUser) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }

    return this.auditoriaService.marcarEventosSeguridadRevisados(user.id);
  }

  @Get()
  @Roles(Role.ADMINISTRADOR)
  listar(@CurrentUser() user: AuthUser, @Query() query: QueryAuditoriaDto) {
    if (!user.esMaster) {
      throw new ForbiddenException(
        'Solo el Administrador Master puede acceder a trazabilidad',
      );
    }
    return this.auditoriaService.listarAuditoria(query);
  }
}
