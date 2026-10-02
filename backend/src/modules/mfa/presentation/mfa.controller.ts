import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import {
  ApiCsrf,
  ApiMobileAuth,
  ApiSessionAuth,
} from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  AllowAccountStates,
  CurrentUser,
} from '../../auth/presentation/decorators/auth.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { AccountState } from '../../users/domain/account-state';
import {
  MfaService,
  MfaStatusView,
  RecoveryCodesView,
  TotpSetupView,
} from '../application/mfa.service';
import {
  ConfirmTotpSetupDto,
  MfaCodeDto,
  MfaStatusResponse,
  RecoveryCodesResponse,
  StartTotpSetupDto,
  TotpSetupResponse,
} from './dto/mfa.dto';

/**
 * The caller's own second factor (web console and mobile app alike). Reachable
 * during MFA_SETUP_REQUIRED, which is exactly when administrators need it.
 */
@ApiTags('mfa')
@ApiSessionAuth()
@ApiMobileAuth()
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
)
@AllowAccountStates(
  AccountState.MFA_SETUP_REQUIRED,
  AccountState.PROFILE_SETUP_REQUIRED,
  AccountState.ACTIVE,
)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  @ApiOperation({ summary: 'My two-step verification status' })
  @ApiEnvelopeResponse(MfaStatusResponse)
  status(@CurrentUser() principal: AuthenticatedUser): Promise<MfaStatusView> {
    return this.mfa.getStatus(principal.userId);
  }

  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_MANAGE)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Start an authenticator setup (or replace the current one: then a code is required)',
  })
  @ApiEnvelopeResponse(TotpSetupResponse)
  startSetup(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: StartTotpSetupDto,
    @ClientInfo() client: ClientContext,
  ): Promise<TotpSetupView> {
    return this.mfa.startTotpSetup(principal.userId, dto.code, client);
  }

  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_MANAGE)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Confirm the setup with a code from the app; returns 10 recovery codes (shown once)',
  })
  @ApiEnvelopeResponse(RecoveryCodesResponse)
  confirmSetup(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: ConfirmTotpSetupDto,
    @ClientInfo() client: ClientContext,
  ): Promise<RecoveryCodesView> {
    return this.mfa.confirmTotpSetup(principal.userId, dto.code, client);
  }

  @Post('recovery-codes')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_MANAGE)
  @ApiCsrf()
  @ApiOperation({
    summary: 'Replace all recovery codes (needs a current code)',
  })
  @ApiEnvelopeResponse(RecoveryCodesResponse)
  regenerateRecoveryCodes(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
    @ClientInfo() client: ClientContext,
  ): Promise<RecoveryCodesView> {
    return this.mfa.regenerateRecoveryCodes(principal.userId, dto.code, client);
  }

  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_MANAGE)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Turn two-step verification off (needs a current code; not allowed for administrators)',
  })
  @ApiEnvelopeResponse(MfaStatusResponse)
  disable(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MfaStatusView> {
    return this.mfa.disable(principal.userId, dto.code, client);
  }
}
