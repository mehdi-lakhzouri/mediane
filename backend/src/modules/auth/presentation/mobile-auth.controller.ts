import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags, PickType } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiMobileAuth } from '../../../common/http/swagger/api-security.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { SkipCsrf } from '../../security/presentation/skip-csrf.decorator';
import { SessionChannel } from '../../sessions/domain/refresh-session';
import { AccountState } from '../../users/domain/account-state';
import { AuthService, IssuedTokens } from '../application/auth.service';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import {
  AllowAccountStates,
  CurrentUser,
  Public,
} from './decorators/auth.decorators';
import {
  ChangePasswordDto,
  LoginDto,
  MfaChallengeDto,
} from './dto/auth-request.dto';
import { MfaChallengeResponse } from './dto/auth-response.dto';
import {
  MobileRefreshDto,
  MobileSessionLoginResponse,
  MobileSessionResponse,
} from './dto/mobile-auth.dto';

class MobileLoginDto extends PickType(LoginDto, ['email', 'password']) {}

function toMobileSession(tokens: IssuedTokens): MobileSessionResponse {
  return {
    userId: tokens.principal.userId,
    role: tokens.principal.role,
    accountState: tokens.principal.accountState,
    tokenType: 'Bearer',
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  };
}

/**
 * Mobile app adapter (drivers only). Same use cases, sessions, rotation and
 * reuse detection as the web console; only the transport differs: tokens
 * travel in the body and in `Authorization: Bearer`, never in cookies.
 * No CSRF here: nothing in these requests is attached by a browser on its own.
 * /auth/me and /auth/logout-all are shared with the web (AuthController).
 */
@ApiTags('auth (mobile)')
@SkipCsrf()
@ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
@Controller('auth/mobile')
export class MobileAuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.LOGIN)
  @ApiOperation({ summary: 'Log in from the mobile app (drivers)' })
  @ApiEnvelopeResponse([MobileSessionLoginResponse, MfaChallengeResponse], {
    description:
      'mfaRequired=false: signed in. mfaRequired=true: send mfaToken and a code to POST /auth/mobile/mfa/challenge.',
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async login(
    @Body() dto: MobileLoginDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MobileSessionLoginResponse | MfaChallengeResponse> {
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      // The device keystore keeps the session until logout or expiry.
      rememberMe: true,
      channel: SessionChannel.MOBILE,
      client,
    });
    if (result.kind === 'MFA_REQUIRED') {
      return { mfaRequired: true, ...result.challenge };
    }
    return { mfaRequired: false, ...toMobileSession(result.tokens) };
  }

  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_CHALLENGE)
  @ApiOperation({
    summary:
      'Second sign-in step (mobile): authenticator or recovery code; returns the session',
  })
  @ApiEnvelopeResponse(MobileSessionResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async completeMfaChallenge(
    @Body() dto: MfaChallengeDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MobileSessionResponse> {
    return toMobileSession(
      await this.auth.completeMfaChallenge(
        dto.mfaToken,
        dto.code,
        SessionChannel.MOBILE,
        client,
      ),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.REFRESH)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  @ApiEnvelopeResponse(MobileSessionResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async refresh(
    @Body() dto: MobileRefreshDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MobileSessionResponse> {
    return toMobileSession(
      await this.auth.refresh(dto.refreshToken, SessionChannel.MOBILE, client),
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke this device session' })
  @ApiEnvelopeResponse(null)
  async logout(
    @Body() dto: MobileRefreshDto,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.auth.logout(dto.refreshToken, SessionChannel.MOBILE, client);
    return null;
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @AllowAccountStates(
    AccountState.PASSWORD_CHANGE_REQUIRED,
    AccountState.MFA_SETUP_REQUIRED,
    AccountState.PROFILE_SETUP_REQUIRED,
    AccountState.ACTIVE,
  )
  @RateLimit(RateLimitPolicies.CHANGE_PASSWORD)
  @ApiMobileAuth()
  @ApiOperation({
    summary:
      'Change password (mandatory after a temporary password). Every session is revoked; the response carries the new one.',
  })
  @ApiEnvelopeResponse(MobileSessionResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async changePassword(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @ClientInfo() client: ClientContext,
  ): Promise<MobileSessionResponse> {
    return toMobileSession(
      await this.auth.changePassword(principal, {
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
        mfaCode: dto.mfaCode,
        client,
      }),
    );
  }
}
