import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiCsrf } from '../../../common/http/swagger/api-security.decorators';
import { Public } from '../../auth/presentation/decorators/auth.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { InvitationsService } from '../application/invitations.service';
import { AcceptInvitationDto } from './dto/invitation.dto';

/** Public side of invitations. Admin operations live in admin/. */
@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitPolicies.INVITATION_ACCEPT)
  @ApiCsrf()
  @ApiOperation({ summary: 'Accept an invitation (single-use token)' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async accept(
    @Body() dto: AcceptInvitationDto,
    @ClientInfo() client: ClientContext,
  ): Promise<null> {
    await this.invitations.accept(dto.token, client);
    return null;
  }
}
