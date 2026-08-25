import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { DirectUploadPlan, StorageProvider, StoredObject } from './storage.provider';

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

    const publicId = this.buildPublicId(dealId, originalName);

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

  async prepareDirectUpload(dealId: string, originalName: string): Promise<DirectUploadPlan> {
    this.assertConfigured();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    const publicId = this.buildPublicId(dealId, originalName);
    const timestamp = Math.floor(Date.now() / 1000);
    const type = 'authenticated';
    const signature = cloudinary.utils.api_sign_request(
      {
        public_id: publicId,
        timestamp,
        type
      },
      apiSecret
    );

    return {
      mode: 'direct',
      key: `cloudinary:${publicId}`,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw/upload`,
      fields: {
        api_key: apiKey,
        public_id: publicId,
        timestamp: String(timestamp),
        type,
        signature
      }
    };
  }

  async verifyDirectUpload(dealId: string, key: string): Promise<StoredObject> {
    this.assertConfigured();
    const publicId = this.publicIdFromKey(key);
    const expectedPrefix = `amanat/evidence/${dealId}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      throw new Error('Cloudinary evidence does not belong to this deal');
    }

    const buffer = await this.read(key);
    return {
      key,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.length
    };
  }

  async read(key: string): Promise<Buffer> {
    this.assertConfigured();

    const publicId = this.publicIdFromKey(key);
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

  private buildPublicId(dealId: string, originalName: string) {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
    return `amanat/evidence/${dealId}/${randomUUID()}-${safeName}`;
  }

  private publicIdFromKey(key: string) {
    const prefix = 'cloudinary:';
    if (!key.startsWith(prefix)) {
      throw new Error('Invalid Cloudinary storage key');
    }
    return key.slice(prefix.length);
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
