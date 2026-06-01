import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { obtenerIpCliente } from '../../common/utils/client-ip.util';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  crear(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.feedbackService.crear(dto, actor, {
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get()
  listar(@Query() query: QueryFeedbackDto, @CurrentUser() actor: AuthUser) {
    return this.feedbackService.listar(query, actor);
  }

  @Get('pendientes-count')
  pendientesCount(@CurrentUser() actor: AuthUser) {
    return this.feedbackService.contarPendientes(actor);
  }

  @Patch(':id/revisar')
  revisar(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.feedbackService.marcarRevisado(id, actor, {
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}
