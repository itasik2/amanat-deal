import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealAccessService } from './deal-access.service';
import { DealInvitationsController } from './deal-invitations.controller';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { SecureInvitationsService } from './secure-invitations.service';

@Module({
  imports: [AuthModule],
  controllers: [DealsController, DealInvitationsController],
  providers: [DealsService, SecureInvitationsService, DealAccessService],
  exports: [DealAccessService]
})
export class DealsModule {}
