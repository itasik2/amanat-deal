import { Module } from '@nestjs/common';
import { DealsModule } from './modules/deals/deals.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule, HealthModule, DealsModule, EvidenceModule, DisputesModule]
})
export class AppModule {}
