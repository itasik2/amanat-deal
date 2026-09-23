import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    const evidenceStorage = this.evidenceStorageStatus();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        degraded: evidenceStorage.ready ? false : true,
        service: 'amanat-api',
        database: 'ready',
        evidenceStorage,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'amanat-api',
        database: 'unavailable',
        evidenceStorage,
        checkedAt: new Date().toISOString()
      });
    }
  }

  private evidenceStorageStatus() {
    const cloudinaryReady = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
    );
    if (cloudinaryReady) {
      return { ready: true, mode: 'cloudinary' };
    }

    const persistentLocal = Boolean(
      process.env.EVIDENCE_STORAGE_DIR?.trim() ||
      process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()
    );
    if (persistentLocal) {
      return { ready: true, mode: 'persistent-local' };
    }

    const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
    if (isVercel) {
      return { ready: false, mode: 'unavailable-serverless' };
    }

    return { ready: true, mode: 'local-development' };
  }
}
