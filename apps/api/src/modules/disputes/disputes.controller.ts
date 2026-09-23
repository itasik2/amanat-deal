import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import type { PublicUser } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DealAccessService } from '../deals/deal-access.service';
import {
  DisputeAssistanceRequestInput,
  DisputeMessageInput,
  DisputeProposalInput,
  DisputeResponseInput,
  DisputesService
} from './disputes.service';

@Controller('deals')
@UseGuards(SessionAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly access: DealAccessService
  ) {}

  @Get(':id/dispute/messages')
  async list(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.roleForUser(id, user.id);
    return this.disputes.list(id);
  }

  @Get(':id/dispute/assistance')
  async assistance(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.roleForUser(id, user.id);
    return this.disputes.assistance(id);
  }

  @Post(':id/dispute/assistance/request')
  async requestAssistance(
    @Param('id') id: string,
    @Body() body: DisputeAssistanceRequestInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.disputes.requestAssistance(id, { ...body, actorRole: role, actorUserId: user.id });
  }

  @Post(':id/dispute/messages')
  async message(
    @Param('id') id: string,
    @Body() body: DisputeMessageInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.disputes.message(id, { ...body, actorRole: role, actorUserId: user.id });
  }

  @Post(':id/dispute/proposals')
  async proposal(
    @Param('id') id: string,
    @Body() body: DisputeProposalInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.disputes.proposal(id, { ...body, actorRole: role, actorUserId: user.id });
  }

  @Post(':id/dispute/proposals/:proposalId/respond')
  async respond(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body() body: DisputeResponseInput,
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    return this.disputes.respond(id, proposalId, { ...body, actorRole: role, actorUserId: user.id });
  }
}
