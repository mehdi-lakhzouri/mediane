import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppError, ErrorDetail, ErrorKind } from '../../errors';

export class RequestValidationError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor(details: readonly ErrorDetail[]) {
    super('VALIDATION_FAILED', 'The request contains invalid data.', details);
  }
}

function flatten(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * Strict global validation: unknown properties are rejected (not silently stripped),
 * no implicit type coercion, and rejected values are never echoed back.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new RequestValidationError(flatten(errors)),
  });
}
