import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  DisputeAssistanceRequestInput,
  DisputeMessageInput,
  DisputeProposalInput,
  DisputeResponseInput,
  DisputesService
} from './disputes.service';

@Controller('deals')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get(':id/dispute/messages')
  list(@Param('id') id: string) {
    return this.disputes.list(id);
  }

  @Get(':id/dispute/assistance')
  assistance(@Param('id') id: string) {
    return this.disputes.assistance(id);
  }

  @Post(':id/dispute/assistance/request')
  requestAssistance(@Param('id') id: string, @Body() body: DisputeAssistanceRequestInput) {
    return this.disputes.requestAssistance(id, body);
  }

  @Post(':id/dispute/messages')
  message(@Param('id') id: string, @Body() body: DisputeMessageInput) {
    return this.disputes.message(id, body);
  }

  @Post(':id/dispute/proposals')
  proposal(@Param('id') id: string, @Body() body: DisputeProposalInput) {
    return this.disputes.proposal(id, body);
  }

  @Post(':id/dispute/proposals/:proposalId/respond')
  respond(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body() body: DisputeResponseInput
  ) {
    return this.disputes.respond(id, proposalId, body);
  }
}
