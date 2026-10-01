import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli/cli.module';

async function bootstrap(): Promise<void> {
  await CommandFactory.run(CliModule, {
    logger: ['error', 'warn'],
    errorHandler: (error) => {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    },
  });
}

void bootstrap();
