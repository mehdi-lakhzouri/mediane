import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { allConfigs, validateEnv } from '../config';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { UsersModule } from '../modules/users/users.module';
import { CreateAdminCommand } from './commands/create-admin.command';
import { CreateAdminQuestions } from './commands/create-admin.questions';

/** Separate root module: no HTTP stack, no controllers, only what commands need. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: allConfigs,
    }),
    PrismaModule,
    UsersModule,
  ],
  providers: [CreateAdminCommand, CreateAdminQuestions],
})
export class CliModule {}
