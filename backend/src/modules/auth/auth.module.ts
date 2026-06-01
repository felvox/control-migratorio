import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { SessionMaintenanceService } from './session-maintenance.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'dev_secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '8h'),
        },
      }),
    }),
    AuditoriaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessionMaintenanceService],
  exports: [AuthService],
})
export class AuthModule {}
