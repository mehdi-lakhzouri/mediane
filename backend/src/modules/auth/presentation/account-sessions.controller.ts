import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
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
  type ActiveSessionView,
  SessionsService,
} from '../../sessions/application/sessions.service';
import { DevicePlatform } from '../../sessions/domain/device-description';
import { SessionChannel } from '../../sessions/domain/refresh-session';
import type { AuthenticatedUser } from '../domain/authenticated-user';
import {
  AllowAnyAuthenticatedState,
  CurrentUser,
} from './decorators/auth.decorators';

class SessionDeviceResponse {
  @ApiProperty({ example: 'Pixel 8 · Android 15' }) label!: string;
  @ApiProperty({ enum: Object.values(DevicePlatform) })
  platform!: DevicePlatform;
  @ApiProperty({ description: 'The Mediane app rather than a browser' })
  app!: boolean;
}

class ActiveSessionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Object.values(SessionChannel) })
  channel!: SessionChannel;
  @ApiProperty({ type: SessionDeviceResponse })
  device!: SessionDeviceResponse;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty() signedInAt!: Date;
  @ApiProperty() lastActiveAt!: Date;
  @ApiProperty({ description: 'The device making this request' })
  current!: boolean;
}

class RevokedSessionsResponse {
  @ApiProperty() revoked!: number;
}

/**
 * The caller's signed-in devices. Sessions are only ever addressed among the
 * caller's own; the current one ends through logout, which also clears its
 * tokens on the device.
 */
@ApiTags('auth / sessions')
@ApiMobileAuth()
@ApiSessionAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED)
@AllowAnyAuthenticatedState()
@Controller('auth/sessions')
export class AccountSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'My signed-in devices, most recently active first' })
  @ApiEnvelopeResponse(ActiveSessionResponse, { isArray: true })
  list(@CurrentUser() me: AuthenticatedUser): Promise<ActiveSessionView[]> {
    return this.sessions.listActive(me.userId, me.sessionId);
  }

  @Post('revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiCsrf()
  @ApiOperation({ summary: 'Sign out every device except this one' })
  @ApiEnvelopeResponse(RevokedSessionsResponse)
  async revokeOthers(
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<RevokedSessionsResponse> {
    return {
      revoked: await this.sessions.revokeOthers(
        me.userId,
        me.sessionId,
        client,
      ),
    };
  }

  @Delete(':sessionId')
  @ApiCsrf()
  @ApiOperation({ summary: 'Sign out one of my other devices' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(HttpStatus.NOT_FOUND, HttpStatus.UNPROCESSABLE_ENTITY)
  async revoke(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() me: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.sessions.revokeOwn(me.userId, sessionId, me.sessionId, client);
    return null;
  }
}
