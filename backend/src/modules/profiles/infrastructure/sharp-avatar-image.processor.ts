import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  AVATAR_MIN_SIDE_PX,
  AVATAR_OUTPUT_SIDE_PX,
  AvatarImageProcessor,
  InvalidAvatarImageError,
  ProcessedImage,
} from '../application/avatar-image-processor';

/** What sharp detects from the file's bytes, not what the client claims. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Decompression-bomb guard: a tiny file must not expand to gigabytes of pixels. */
const MAX_INPUT_PIXELS = 40_000_000;

const INPUT_OPTIONS: sharp.SharpOptions = {
  limitInputPixels: MAX_INPUT_PIXELS,
  failOn: 'error',
  // First frame only for animated WebP.
  animated: false,
};

@Injectable()
export class SharpAvatarImageProcessor implements AvatarImageProcessor {
  async process(upload: Buffer): Promise<ProcessedImage> {
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(upload, INPUT_OPTIONS).metadata();
    } catch {
      throw new InvalidAvatarImageError('is not a readable image');
    }
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new InvalidAvatarImageError('must be a JPEG, PNG or WebP image');
    }
    // The shorter side is the same whatever the EXIF orientation.
    if (Math.min(metadata.width, metadata.height) < AVATAR_MIN_SIDE_PX) {
      throw new InvalidAvatarImageError(
        `must be at least ${AVATAR_MIN_SIDE_PX}×${AVATAR_MIN_SIDE_PX} pixels`,
      );
    }

    try {
      const data = await sharp(upload, INPUT_OPTIONS)
        .rotate() // applies the EXIF orientation before metadata is dropped
        .resize(AVATAR_OUTPUT_SIDE_PX, AVATAR_OUTPUT_SIDE_PX, {
          fit: 'cover',
          position: 'centre',
        })
        // sharp writes no metadata unless asked to: EXIF, GPS, XMP are gone.
        .webp({ quality: 82 })
        .toBuffer();
      return { data, contentType: 'image/webp', extension: 'webp' };
    } catch {
      throw new InvalidAvatarImageError('is not a readable image');
    }
  }
}
