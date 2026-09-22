import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealsModule } from '../deals/deals.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [AuthModule, DealsModule],
  controllers: [EvidenceController],
  providers: [EvidenceService]
})
export class EvidenceModule {}
