import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, StoredObject } from './storage.provider';

@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }

  async save(dealId: string, originalName: string, buffer: Buffer): Promise<StoredObject> {
    this.assertConfigured();

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
    const publicId = `amanat/evidence/${dealId}/${randomUUID()}-${safeName}`;

    await new Promise<void>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          public_id: publicId,
          overwrite: false
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve();
        }
      );

      stream.end(buffer);
    });

    return {
      key: `cloudinary:${publicId}`,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.length
    };
  }

  async read(key: string): Promise<Buffer> {
    this.assertConfigured();

    const prefix = 'cloudinary:';
    if (!key.startsWith(prefix)) {
      throw new Error('Invalid Cloudinary storage key');
    }

    const publicId = key.slice(prefix.length);
    if (!publicId.startsWith('amanat/evidence/')) {
      throw new Error('Invalid Cloudinary evidence path');
    }

    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      secure: true,
      sign_url: true
    });

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Cloudinary download failed with status ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private assertConfigured() {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error('Cloudinary storage is not configured');
    }
  }
}
