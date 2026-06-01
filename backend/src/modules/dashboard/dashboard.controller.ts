import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  @Roles(Role.ADMINISTRADOR)
  obtenerResumen(@CurrentUser() user: AuthUser, @Query('fecha') fecha?: string) {
    return this.dashboardService.resumenAdministrador(user, fecha);
  }

  @Get('monitoreo-master')
  @Roles(Role.ADMINISTRADOR)
  obtenerMonitoreoMaster(
    @CurrentUser() user: AuthUser,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('jaf') jaf?: string,
  ) {
    return this.dashboardService.resumenMonitoreoMaster(user, {
      fechaDesde,
      fechaHasta,
      jaf,
    });
  }
}
