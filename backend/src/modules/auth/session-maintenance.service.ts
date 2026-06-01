import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MotivoCierreSesion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.ejecutarCierreSesionesExpiradas().catch(() => undefined);

    const intervaloSegundos = Math.max(
      15,
      this.configService.get<number>('session.cleanupIntervalSeconds', 60) ?? 60,
    );

    this.timer = setInterval(() => {
      this.ejecutarCierreSesionesExpiradas().catch(() => undefined);
    }, intervaloSegundos * 1000);
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async ejecutarCierreSesionesExpiradas(): Promise<void> {
    const idleTimeoutMinutes = Math.max(
      1,
      this.configService.get<number>('session.idleTimeoutMinutes', 30) ?? 30,
    );

    const ahora = new Date();
    const limiteInactividad = new Date(
      ahora.getTime() - idleTimeoutMinutes * 60 * 1000,
    );

    await this.prisma.sesionAcceso.updateMany({
      where: {
        cierreSesion: null,
        ultimaActividadAt: {
          lt: limiteInactividad,
        },
      },
      data: {
        cierreSesion: ahora,
        motivoCierre: MotivoCierreSesion.INACTIVIDAD,
      },
    });
  }
}
