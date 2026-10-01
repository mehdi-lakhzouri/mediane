import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, type AppConfig } from '../../config';
import { buildPinoParams } from './pino-options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: AppConfig) => buildPinoParams(app),
    }),
  ],
})
export class LoggingModule {}
