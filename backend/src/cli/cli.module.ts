import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { allConfigs, validateEnv } from '../config';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { DevicesModule } from '../modules/devices/devices.module';
import { UsersModule } from '../modules/users/users.module';
import { CreateAdminCommand } from './commands/create-admin.command';
import { CreateAdminQuestions } from './commands/create-admin.questions';
import { RegisterDeviceCommand } from './commands/register-device.command';
import { SimulateDeviceCommand } from './commands/simulate-device.command';

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
    DevicesModule,
  ],
  providers: [
    CreateAdminCommand,
    CreateAdminQuestions,
    RegisterDeviceCommand,
    SimulateDeviceCommand,
  ],
})
export class CliModule {}
