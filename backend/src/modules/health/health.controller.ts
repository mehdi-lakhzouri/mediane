import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../common/http/swagger/api-envelope.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Public } from '../auth/presentation/decorators/auth.decorators';

class HealthResponse {
  @ApiProperty({ example: 'ok' }) status!: 'ok';
  @ApiProperty({ example: 'up' }) database!: 'up';
}

/** Liveness/readiness probe. Reveals nothing beyond "up/down". */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Service and database health' })
  @ApiEnvelopeResponse(HealthResponse)
  @ApiErrorResponses(HttpStatus.SERVICE_UNAVAILABLE)
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      this.logger.error({ err }, 'Database health check failed');
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', database: 'up' };
  }
}
