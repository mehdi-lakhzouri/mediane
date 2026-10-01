import { Module } from '@nestjs/common';
import { PasswordHasher } from './application/password-hasher';
import { Argon2PasswordHasher } from './infrastructure/argon2-password.hasher';
import { CsrfTokenService } from './infrastructure/csrf-token.service';
import { SecureTokenService } from './infrastructure/secure-token.service';

/** Cryptographic building blocks. Global HTTP guards are wired in AppModule. */
@Module({
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    SecureTokenService,
    CsrfTokenService,
  ],
  exports: [PasswordHasher, SecureTokenService, CsrfTokenService],
})
export class SecurityModule {}
