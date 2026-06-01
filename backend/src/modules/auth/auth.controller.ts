import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TransferMasterDto } from './dto/transfer-master.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { obtenerIpCliente } from '../../common/utils/client-ip.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, {
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: LogoutDto,
    @Req() req: Request,
  ) {
    await this.authService.logout(user.id, user.sesionId, {
      motivo: dto.motivoCierre,
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });

    return {
      message: 'Sesión cerrada correctamente',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.id, dto, {
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Get('master-candidates')
  @UseGuards(JwtAuthGuard)
  masterCandidates(@CurrentUser() user: AuthUser) {
    if (!user.esMaster) {
      throw new ForbiddenException('Solo el administrador master puede ver esta lista');
    }

    return this.authService.listMasterCandidates(user.id);
  }

  @Post('transfer-master')
  @UseGuards(JwtAuthGuard)
  transferMaster(
    @CurrentUser() user: AuthUser,
    @Body() dto: TransferMasterDto,
    @Req() req: Request,
  ) {
    return this.authService.transferMaster(user.id, dto, {
      ip: obtenerIpCliente(req),
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}
