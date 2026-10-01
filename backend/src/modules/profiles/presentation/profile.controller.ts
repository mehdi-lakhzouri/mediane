import { Body, Controller, Get, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import {
  ApiCsrf,
  ApiSessionAuth,
} from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  AllowAccountStates,
  CurrentUser,
  Roles,
} from '../../auth/presentation/decorators/auth.decorators';
import { AccountState } from '../../users/domain/account-state';
import { Role } from '../../users/domain/role';
import { ProfilesService, ProfileView } from '../application/profiles.service';
import { ProfileResponse, SaveProfileDto } from './dto/profile.dto';

/** "/profile" is always the caller's own profile: no id in the route, no IDOR surface. */
@ApiTags('profile')
@ApiSessionAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Roles(Role.DRIVER)
@AllowAccountStates(AccountState.PROFILE_SETUP_REQUIRED, AccountState.ACTIVE)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile' })
  @ApiEnvelopeResponse(ProfileResponse)
  getOwn(@CurrentUser() principal: AuthenticatedUser): Promise<ProfileView> {
    return this.profiles.getOwnProfile(principal.userId);
  }

  @Put()
  @ApiCsrf()
  @ApiOperation({ summary: 'Create/update my profile (completes onboarding)' })
  @ApiEnvelopeResponse(ProfileResponse)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  saveOwn(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: SaveProfileDto,
    @ClientInfo() client: ClientContext,
  ): Promise<ProfileView> {
    return this.profiles.saveOwnProfile(principal.userId, dto, client);
  }
}
