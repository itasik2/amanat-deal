import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { StorageProvider, StoredObject } from './storage.provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly root = process.env.EVIDENCE_STORAGE_DIR
    ? resolve(process.env.EVIDENCE_STORAGE_DIR)
    : process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'evidence')
      : resolve(process.cwd(), '../../.data/evidence');

  async save(dealId: string, originalName: string, buffer: Buffer): Promise<StoredObject> {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
    const key = `${dealId}/${randomUUID()}-${safeName}`;
    const target = resolve(this.root, key);

    await mkdir(resolve(this.root, dealId), { recursive: true });
    await writeFile(target, buffer, { flag: 'wx' });

    return {
      key,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.length
    };
  }

  async read(key: string): Promise<Buffer> {
    const target = resolve(this.root, key);
    const allowedPrefix = this.root.endsWith(sep) ? this.root : `${this.root}${sep}`;
    if (!target.startsWith(allowedPrefix)) {
      throw new BadRequestException('Invalid storage key');
    }
    return readFile(target);
  }
}
