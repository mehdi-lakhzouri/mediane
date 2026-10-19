import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { SessionChannel } from '../../sessions/domain/refresh-session';
import { AccountState } from '../../users/domain/account-state';
import {
  AuthService,
  type CurrentUserView,
  IssuedTokens,
} from '../application/auth.service';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import { AuthCookieService } from './auth-cookie.service';
import {
  AllowAccountStates,
  AllowAnyAuthenticatedState,
  CurrentUser,
  Public,
} from './decorators/auth.decorators';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MfaChallengeDto,
  ResetPasswordDto,
} from './dto/auth-request.dto';
import {
  CsrfTokenResponse,
  CurrentUserResponse,
  MfaChallengeResponse,
  SessionOpenedResponse,
  SessionPrincipalResponse,
  SessionActivityResponse,
  WebSessionLoginResponse,
} from './dto/auth-response.dto';

function toPrincipalResponse(
  principal: AuthenticatedUser,
): SessionPrincipalResponse {
  return {
    userId: principal.userId,
    role: principal.role,
    accountState: principal.accountState,
  };
}

function toSessionOpenedResponse(
  tokens: IssuedTokens,
  csrfToken: string,
): SessionOpenedResponse {
  return { ...toPrincipalResponse(tokens.principal), csrfToken };
}

/**
 * Web console adapter: parses input, delegates to AuthService, manages cookies.
 * Only administrators can sign in here (drivers use MobileAuthController).
 * /me and logout-all are shared: they accept either transport.
 */
@ApiTags('auth')
@ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @Get('csrf')
  @RateLimit(RateLimitPolicies.CSRF_TOKEN)
  @ApiOperation({ summary: 'Issue a CSRF token (cookie + body)' })
  @ApiEnvelopeResponse(CsrfTokenResponse)
  issueCsrfToken(@Res({ passthrough: true }) res: Response): CsrfTokenResponse {
    return { csrfToken: this.cookies.issueCsrfToken(res) };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.LOGIN)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Log in to the web console (administrators); sets HttpOnly cookies',
  })
  @ApiEnvelopeResponse([WebSessionLoginResponse, MfaChallengeResponse], {
    description:
      'mfaRequired=false: signed in (cookies set). mfaRequired=true: send mfaToken and a code to POST /auth/mfa/challenge.',
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async login(
    @Body() dto: LoginDto,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WebSessionLoginResponse | MfaChallengeResponse> {
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      rememberMe: dto.rememberMe ?? true,
      channel: SessionChannel.WEB,
      client,
    });
    if (result.kind === 'MFA_REQUIRED') {
      return { mfaRequired: true, ...result.challenge };
    }
    return {
      mfaRequired: false,
      ...toSessionOpenedResponse(
        result.tokens,
        this.cookies.setSessionCookies(res, result.tokens),
      ),
    };
  }

  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.MFA_CHALLENGE)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Second sign-in step (web): authenticator or recovery code; sets session cookies',
  })
  @ApiEnvelopeResponse(SessionOpenedResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async completeMfaChallenge(
    @Body() dto: MfaChallengeDto,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionOpenedResponse> {
    const tokens = await this.auth.completeMfaChallenge(
      dto.mfaToken,
      dto.code,
      SessionChannel.WEB,
      client,
    );
    return toSessionOpenedResponse(
      tokens,
      this.cookies.setSessionCookies(res, tokens),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.REFRESH)
  @ApiCsrf()
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  @ApiEnvelopeResponse(SessionOpenedResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async refresh(
    @Req() req: Request,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionOpenedResponse> {
    let tokens: IssuedTokens;
    try {
      tokens = await this.auth.refresh(
        this.cookies.readRefreshToken(req),
        SessionChannel.WEB,
        client,
      );
    } catch (error) {
      // Dead session: drop the stale cookies along with the 401.
      this.cookies.clearSessionCookies(res);
      throw error;
    }
    return toSessionOpenedResponse(
      tokens,
      this.cookies.setSessionCookies(res, tokens),
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({
    summary: 'Revoke the current device session and clear cookies',
  })
  @ApiEnvelopeResponse(null)
  async logout(
    @Req() req: Request,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.auth.logout(
      this.cookies.readRefreshToken(req),
      SessionChannel.WEB,
      client,
    );
    this.cookies.clearSessionCookies(res);
    return null;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @AllowAnyAuthenticatedState()
  @ApiSessionAuth()
  @ApiMobileAuth()
  @ApiCsrf()
  @ApiOperation({
    summary: 'Revoke every session of the current user (web and mobile)',
  })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async logoutAll(
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.auth.logoutAllDevices(principal, client);
    this.cookies.clearSessionCookies(res);
    return null;
  }

  @Get('me')
  @AllowAnyAuthenticatedState()
  @ApiSessionAuth()
  @ApiMobileAuth()
  @ApiOperation({
    summary: 'Current principal and account state (drives client onboarding)',
  })
  @ApiEnvelopeResponse(CurrentUserResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  me(@CurrentUser() principal: AuthenticatedUser): Promise<CurrentUserView> {
    return this.auth.getCurrentUser(principal);
  }

  @Post('activity')
  @HttpCode(HttpStatus.OK)
  @ApiSessionAuth()
  @ApiCsrf()
  @ApiOperation({
    summary: 'Record dashboard activity and extend the web inactivity window',
  })
  @ApiEnvelopeResponse(SessionActivityResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  activity(
    @CurrentUser() principal: AuthenticatedUser,
  ): Promise<SessionActivityResponse> {
    return this.auth.recordWebActivity(principal);
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
  @ApiSessionAuth()
  @ApiCsrf()
  @ApiOperation({
    summary: 'Change password (mandatory after a temporary password)',
  })
  @ApiEnvelopeResponse(SessionOpenedResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async changePassword(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @ClientInfo() client: ClientContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionOpenedResponse> {
    const tokens = await this.auth.changePassword(principal, {
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      mfaCode: dto.mfaCode,
      client,
    });
    // All previous sessions were revoked; this response carries the new one.
    return toSessionOpenedResponse(
      tokens,
      this.cookies.setSessionCookies(res, tokens),
    );
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(RateLimitPolicies.FORGOT_PASSWORD)
  @ApiCsrf()
  @ApiOperation({
    summary:
      'Request a reset email (same response whether the account exists or not)',
  })
  @ApiEnvelopeResponse(null, { status: HttpStatus.ACCEPTED })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.auth.requestPasswordReset(dto.email, client);
    return null;
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.RESET_PASSWORD)
  @ApiCsrf()
  @ApiOperation({ summary: 'Reset the password with an emailed token' })
  @ApiEnvelopeResponse(null)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.auth.resetPassword(dto.token, dto.newPassword, client);
    return null;
  }
}
