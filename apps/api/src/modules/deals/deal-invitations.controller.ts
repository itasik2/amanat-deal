import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SecureInvitationsService } from './secure-invitations.service';

@Controller('deal-invitations')
export class DealInvitationsController {
  constructor(private readonly invitations: SecureInvitationsService) {}

  @Get(':token/preview')
  preview(@Param('token') token: string) {
    return this.invitations.publicPreviewByToken(token);
  }

  @Get(':token/details')
  @UseGuards(SessionAuthGuard)
  details(@Param('token') token: string, @CurrentUser() user: PublicUser) {
    return this.invitations.detailsByToken(token, user);
  }

  @Post(':token/claim')
  @UseGuards(SessionAuthGuard)
  claim(@Param('token') token: string, @CurrentUser() user: PublicUser) {
    return this.invitations.claimByToken(token, user);
  }
}
