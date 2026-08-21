import { Module } from '@nestjs/common';
import { DealInvitationsController } from './deal-invitations.controller';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({
  controllers: [DealsController, DealInvitationsController],
  providers: [DealsService]
})
export class DealsModule {}
