import { Module } from '@nestjs/common';
import { storageConfig, type StorageConfig } from '../../config';
import { SecurityModule } from '../security/security.module';
import { FileStorage } from './application/file-storage';
import { LocalDiskFileStorage } from './infrastructure/local-disk.file-storage';
import { S3FileStorage } from './infrastructure/s3.file-storage';
import { LocalFilesController } from './presentation/local-files.controller';

/**
 * Binary object storage. The adapter is chosen by STORAGE_DRIVER: `local`
 * (development folder) or `s3` (production bucket); callers only see FileStorage.
 */
@Module({
  imports: [SecurityModule],
  controllers: [LocalFilesController],
  providers: [
    LocalDiskFileStorage,
    {
      provide: FileStorage,
      inject: [storageConfig.KEY, LocalDiskFileStorage],
      useFactory: (config: StorageConfig, local: LocalDiskFileStorage) =>
        config.driver === 's3' ? new S3FileStorage(config) : local,
    },
  ],
  exports: [FileStorage],
})
export class StorageModule {}
