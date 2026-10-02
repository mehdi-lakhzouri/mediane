import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppError, ErrorKind } from '../../../common/errors';
import { storageConfig, type StorageConfig } from '../../../config';
import { Public } from '../../auth/presentation/decorators/auth.decorators';
import { STORAGE_KEY_PATTERN } from '../application/file-storage';
import { LocalDiskFileStorage } from '../infrastructure/local-disk.file-storage';

const CONTENT_TYPES: Readonly<Record<string, string>> = { webp: 'image/webp' };

/** Same answer for a missing file, a bad signature or an expired link. */
class FileNotFoundError extends AppError {
  readonly kind = ErrorKind.NOT_FOUND;

  constructor() {
    super('FILE_NOT_FOUND', 'The requested file was not found.');
  }
}

/**
 * Serves locally stored files behind signed, expiring links (the local
 * equivalent of S3 pre-signed URLs). Inert unless STORAGE_DRIVER=local.
 * Public on purpose: the signature is the authorization, so image widgets can
 * load the URL directly, exactly as with S3.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class LocalFilesController {
  constructor(
    @Inject(storageConfig.KEY) private readonly config: StorageConfig,
    private readonly storage: LocalDiskFileStorage,
  ) {}

  @Get(':folder/:name')
  async download(
    @Param('folder') folder: string,
    @Param('name') name: string,
    @Query('expires') expires: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const key = `${folder}/${name}`;
    const contentType = CONTENT_TYPES[name.split('.').pop() ?? ''];
    const expiresAt = Number(expires);
    if (
      this.config.driver !== 'local' ||
      !STORAGE_KEY_PATTERN.test(key) ||
      !contentType ||
      !signature ||
      !/^\d{1,12}$/.test(expires ?? '') ||
      !this.storage.isValidSignature(key, expiresAt, signature)
    ) {
      throw new FileNotFoundError();
    }

    const path = this.storage.pathOf(key);
    const file = await stat(path).catch(() => null);
    if (!file?.isFile()) throw new FileNotFoundError();

    const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
    return new StreamableFile(createReadStream(path), {
      type: contentType,
      length: file.size,
      disposition: 'inline',
    });
  }
}
