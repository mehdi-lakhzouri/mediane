import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
} from 'nest-commander';
import { AppError } from '../../common/errors';
import { BootstrapAdminService } from '../../modules/users/application/bootstrap-admin.service';
import {
  CREATE_ADMIN_QUESTIONS,
  CreateAdminAnswers,
} from './create-admin.questions';

interface CreateAdminOptions {
  email?: string;
  firstName?: string;
  lastName?: string;
  passwordStdin?: boolean;
  allowAdditionalAdmin?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

/**
 * npm run cli -- admin:create [--email a@b.c] [--first-name X] [--last-name Y]
 *                             [--password-stdin] [--allow-additional-admin]
 *
 * The password is NEVER accepted as a CLI argument (it would leak into shell
 * history and the process list): it is prompted (masked) or read from stdin.
 */
@Command({
  name: 'admin:create',
  description: 'Create an administrator account (bootstrap)',
})
export class CreateAdminCommand extends CommandRunner {
  constructor(
    private readonly inquirer: InquirerService,
    private readonly bootstrapAdmin: BootstrapAdminService,
  ) {
    super();
  }

  async run(_params: string[], options: CreateAdminOptions): Promise<void> {
    const initial: Partial<CreateAdminAnswers> = {
      email: options.email,
      firstName: options.firstName,
      lastName: options.lastName,
    };
    if (options.passwordStdin) {
      const password = await readStdin();
      initial.password = password;
      initial.passwordConfirmation = password;
    }

    const answers = await this.inquirer.ask<CreateAdminAnswers>(
      CREATE_ADMIN_QUESTIONS,
      initial,
    );
    if (answers.password !== answers.passwordConfirmation) {
      this.fail('Passwords do not match.');
      return;
    }

    try {
      const admin = await this.bootstrapAdmin.execute({
        email: answers.email,
        firstName: answers.firstName,
        lastName: answers.lastName,
        password: answers.password,
        allowAdditionalAdmin: options.allowAdditionalAdmin ?? false,
      });
      console.log(`Administrator created: ${admin.email} (id: ${admin.id})`);
    } catch (error) {
      if (error instanceof AppError) {
        const details = error.details?.map((d) => `  - ${d.message}`) ?? [];
        this.fail([error.message, ...details].join('\n'));
        return;
      }
      throw error;
    }
  }

  @Option({ flags: '-e, --email <email>', description: 'Admin email' })
  parseEmail(value: string): string {
    return value;
  }

  @Option({ flags: '--first-name <firstName>', description: 'First name' })
  parseFirstName(value: string): string {
    return value;
  }

  @Option({ flags: '--last-name <lastName>', description: 'Last name' })
  parseLastName(value: string): string {
    return value;
  }

  @Option({
    flags: '--password-stdin',
    description: 'Read the password from stdin (automation)',
  })
  parsePasswordStdin(): boolean {
    return true;
  }

  @Option({
    flags: '--allow-additional-admin',
    description: 'Allow creating an admin when one already exists',
  })
  parseAllowAdditionalAdmin(): boolean {
    return true;
  }

  private fail(message: string): void {
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}
