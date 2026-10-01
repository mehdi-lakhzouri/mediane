import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/application/unit-of-work';
import { Email } from '../../../common/domain/email';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { PasswordHasher } from '../../security/application/password-hasher';
import { assertPasswordPolicy } from '../../security/domain/password-policy';
import { User } from '../domain/user';
import {
  AdminAlreadyExistsError,
  EmailAlreadyInUseError,
} from '../domain/user.errors';
import { UserRepository } from '../domain/user.repository';

export interface BootstrapAdminCommand {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  allowAdditionalAdmin: boolean;
}

/** Use case behind `npm run cli -- admin:create`. Never reachable over HTTP. */
@Injectable()
export class BootstrapAdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    command: BootstrapAdminCommand,
  ): Promise<{ id: string; email: string }> {
    const email = Email.create(command.email);
    assertPasswordPolicy(command.password, { email: email.value });
    // Hash outside the transaction: Argon2 is deliberately slow.
    const passwordHash = await this.hasher.hash(command.password);

    return this.unitOfWork.run(async () => {
      if (await this.users.existsByEmailIncludingDeleted(email)) {
        throw new EmailAlreadyInUseError();
      }
      if (
        !command.allowAdditionalAdmin &&
        (await this.users.existsActiveAdmin())
      ) {
        throw new AdminAlreadyExistsError();
      }
      const admin = await this.users.create(
        User.newBootstrapAdmin({
          email,
          firstName: command.firstName,
          lastName: command.lastName,
          passwordHash,
          now: new Date(),
        }),
      );
      await this.audit.record({
        action: AuditAction.ADMIN_BOOTSTRAPPED,
        actor: { type: 'CLI' },
        target: { type: 'USER', id: admin.id },
        metadata: { additionalAdmin: command.allowAdditionalAdmin },
      });
      return { id: admin.id, email: admin.email.value };
    });
  }
}
