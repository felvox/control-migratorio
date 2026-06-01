import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { CasosModule } from './modules/casos/casos.module';
import { EvidenciasModule } from './modules/evidencias/evidencias.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { FeedbackModule } from './modules/feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    UsuariosModule,
    CasosModule,
    EvidenciasModule,
    DocumentosModule,
    DashboardModule,
    ReportesModule,
    FeedbackModule,
  ],
})
export class AppModule {}
