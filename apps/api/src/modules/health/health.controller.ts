import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        service: 'amanat-api',
        database: 'ready',
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'amanat-api',
        database: 'unavailable',
        checkedAt: new Date().toISOString()
      });
    }
  }
}
