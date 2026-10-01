import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { configureSwagger } from './bootstrap/configure-swagger';
import { appConfig, type AppConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Parsers are registered with explicit size limits in configureApp.
    bodyParser: false,
  });
  configureApp(app);

  const config = app.get<AppConfig>(appConfig.KEY);
  if (config.swaggerEnabled) configureSwagger(app);

  await app.listen(config.port);
}

void bootstrap();
