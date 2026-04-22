import { Module } from '@nestjs/common';
import { CasosController } from './casos.controller';
import { CasosService } from './casos.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [CasosController],
  providers: [CasosService],
  exports: [CasosService],
})
export class CasosModule {}
