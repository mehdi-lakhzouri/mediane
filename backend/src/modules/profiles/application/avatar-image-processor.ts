import { AppError, ErrorDetail, ErrorKind } from '../../../common/errors';

export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIN_SIDE_PX = 128;
export const AVATAR_OUTPUT_SIDE_PX = 512;

export interface ProcessedImage {
  data: Buffer;
  contentType: string;
  extension: string;
}

export class InvalidAvatarImageError extends AppError {
  readonly kind = ErrorKind.VALIDATION;

  constructor(message: string) {
    const detail: ErrorDetail = { field: 'avatar', message };
    super('INVALID_IMAGE', 'The image could not be used as a profile photo.', [
      detail,
    ]);
  }
}

/**
 * Port. Turns an untrusted upload into a safe, uniform image: the real format
 * is detected from the bytes (never from the file name or declared type), the
 * picture is re-encoded from decoded pixels (no metadata such as GPS position
 * survives) and normalized in size.
 * @throws InvalidAvatarImageError
 */
export abstract class AvatarImageProcessor {
  abstract process(upload: Buffer): Promise<ProcessedImage>;
}
