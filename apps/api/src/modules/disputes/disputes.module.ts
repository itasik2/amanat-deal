import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealsModule } from '../deals/deals.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [AuthModule, DealsModule],
  controllers: [DisputesController],
  providers: [DisputesService]
})
export class DisputesModule {}
