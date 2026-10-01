import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Swagger-only classes describing the response envelope. */

export class ApiPaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
}

export class ApiMetaDto {
  @ApiProperty({ example: '0192f1d2-7c4e-7a51-9d0b-3f2a1c9e8b7d' })
  requestId!: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({ type: ApiPaginationMetaDto })
  pagination?: ApiPaginationMetaDto;
}

export class ApiErrorDetailDto {
  @ApiPropertyOptional({ example: 'email' })
  field?: string;

  @ApiProperty({ example: 'email must be an email' })
  message!: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'The request contains invalid data.' })
  message!: string;

  @ApiPropertyOptional({ type: [ApiErrorDetailDto] })
  details?: ApiErrorDetailDto[];
}
