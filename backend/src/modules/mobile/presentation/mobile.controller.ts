import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../common/http/swagger/api-envelope.decorators';
import { ApiMobileAuth } from '../../../common/http/swagger/api-security.decorators';
import type { AuthenticatedUser } from '../../auth/domain/authenticated-user';
import {
  CurrentUser,
  Public,
  Roles,
} from '../../auth/presentation/decorators/auth.decorators';
import { Role } from '../../users/domain/role';
import { MobileBootstrapService } from '../application/mobile-bootstrap.service';
import { MobileDashboardService } from '../application/mobile-dashboard.service';
import type { MobileDashboard } from '../domain/mobile-dashboard';
import { MobileBootstrapResponse } from './dto/mobile-bootstrap.dto';
import { MobileDashboardResponse } from './dto/mobile-dashboard.dto';

@ApiTags('mobile')
@Controller('mobile')
export class MobileController {
  constructor(
    private readonly bootstrap: MobileBootstrapService,
    private readonly dashboard: MobileDashboardService,
  ) {}

  @Public()
  @Get('bootstrap')
  @ApiOperation({
    summary: 'Get startup policy, product links, and mobile feature flags',
  })
  @ApiEnvelopeResponse(MobileBootstrapResponse)
  getBootstrap(): MobileBootstrapResponse {
    return this.bootstrap.getConfiguration();
  }

  /** Drivers with a completed account only (the default ACTIVE state). */
  @Get('dashboard')
  @Roles(Role.DRIVER)
  @ApiMobileAuth()
  @ApiOperation({
    summary: 'Home screen summary for the signed-in driver, in one read',
  })
  @ApiEnvelopeResponse(MobileDashboardResponse)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  getDashboard(
    @CurrentUser() principal: AuthenticatedUser,
  ): Promise<MobileDashboard> {
    return this.dashboard.getDashboard(principal.userId);
  }
}
