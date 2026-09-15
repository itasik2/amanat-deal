import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealInvitationsController } from './deal-invitations.controller';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { SecureInvitationsService } from './secure-invitations.service';

@Module({
  imports: [AuthModule],
  controllers: [DealsController, DealInvitationsController],
  providers: [DealsService, SecureInvitationsService]
})
export class DealsModule {}
