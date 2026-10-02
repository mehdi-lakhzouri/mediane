import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClientContext } from '../../../common/application/client-context';
import { ClientInfo } from '../../../common/http/decorators/client-context.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiMobileAuth } from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  AllowAccountStates,
  CurrentUser,
  Roles,
} from '../../auth/presentation/decorators/auth.decorators';
import {
  RateLimit,
  RateLimitPolicies,
} from '../../security/presentation/rate-limit.policies';
import { AccountState } from '../../users/domain/account-state';
import { Role } from '../../users/domain/role';
import { AVATAR_MAX_UPLOAD_BYTES } from '../application/avatar-image-processor';
import { ProfilesService, ProfileView } from '../application/profiles.service';
import {
  AvatarUploadDto,
  ProfileResponse,
  SaveProfileDto,
} from './dto/profile.dto';

/**
 * "/profile" is always the caller's own profile: no id in the route, no IDOR
 * surface. Drivers only, from the mobile app (Bearer token).
 */
@ApiTags('profile')
@ApiMobileAuth()
@ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
@Roles(Role.DRIVER)
@AllowAccountStates(AccountState.PROFILE_SETUP_REQUIRED, AccountState.ACTIVE)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile (empty fields until completed)' })
  @ApiEnvelopeResponse(ProfileResponse)
  getOwn(@CurrentUser() principal: AuthenticatedUser): Promise<ProfileView> {
    return this.profiles.getOwnProfile(principal.userId);
  }

  @Put()
  @RateLimit(RateLimitPolicies.PROFILE_UPDATE)
  @ApiOperation({
    summary:
      'Create or replace my profile. The first complete save finishes onboarding (accountState becomes ACTIVE).',
  })
  @ApiEnvelopeResponse(ProfileResponse)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST)
  saveOwn(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: SaveProfileDto,
    @ClientInfo() client: ClientContext,
  ): Promise<ProfileView> {
    return this.profiles.saveOwnProfile(principal.userId, dto, client);
  }

  @Put('avatar')
  @RateLimit(RateLimitPolicies.AVATAR_UPLOAD)
  @UseInterceptors(
    // Memory storage: the upload is never written to disk as-is, only the
    // re-encoded image is stored.
    FileInterceptor('avatar', {
      limits: {
        fileSize: AVATAR_MAX_UPLOAD_BYTES,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AvatarUploadDto })
  @ApiOperation({
    summary:
      'Upload or replace my profile photo (optional). Re-encoded to a 512×512 WebP without metadata.',
  })
  @ApiEnvelopeResponse(ProfileResponse)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.PAYLOAD_TOO_LARGE)
  updateAvatar(
    @CurrentUser() principal: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @ClientInfo() client: ClientContext,
  ): Promise<ProfileView> {
    return this.profiles.updateOwnAvatar(
      principal.userId,
      file?.buffer,
      client,
    );
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove my profile photo' })
  @ApiEnvelopeResponse(ProfileResponse)
  removeAvatar(
    @CurrentUser() principal: AuthenticatedUser,
    @ClientInfo() client: ClientContext,
  ): Promise<ProfileView> {
    return this.profiles.removeOwnAvatar(principal.userId, client);
  }
}
