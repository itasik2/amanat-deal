import { Controller, Get, Param, Post } from '@nestjs/common';
import { DealsService } from './deals.service';

@Controller('deal-invitations')
export class DealInvitationsController {
  constructor(private readonly deals: DealsService) {}

  @Get(':token/preview')
  preview(@Param('token') token: string) {
    return this.deals.invitationPreview(token);
  }

  @Post(':token/claim')
  claim(@Param('token') token: string) {
    return this.deals.claimInvitation(token);
  }
}
