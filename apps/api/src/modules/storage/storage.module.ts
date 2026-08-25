import { Global, Module } from '@nestjs/common';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { STORAGE_PROVIDER } from './storage.provider';

const cloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    CloudinaryStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        localStorage: LocalStorageProvider,
        cloudinaryStorage: CloudinaryStorageProvider
      ) => (cloudinaryConfigured() ? cloudinaryStorage : localStorage),
      inject: [LocalStorageProvider, CloudinaryStorageProvider]
    }
  ],
  exports: [STORAGE_PROVIDER]
})
export class StorageModule {}
