import {
  Controller,
  ForbiddenException,
  Get,
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
