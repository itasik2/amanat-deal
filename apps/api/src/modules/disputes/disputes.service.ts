import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DealRole,
  DealStatus,
  DisputeMessageType,
  SettlementType
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const allowedActorRoles = [DealRole.BUYER, DealRole.SELLER, DealRole.ADMIN];
const disputeStatuses = [DealStatus.PROBLEM_REPORTED, DealStatus.WAITING_LEGAL_RESOLUTION];

export type DisputeMessageInput = {
  actorRole?: string;
  body?: string;
  evidenceId?: string;
};

export type DisputeProposalInput = DisputeMessageInput & {
  settlementType?: string;
  amountKzt?: number;
};

export type DisputeResponseInput = {
  actorRole?: string;
  decision?: 'ACCEPT' | 'REJECT';
  body?: string;
};

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dealId: string) {
    await this.ensureDeal(dealId);
    return this.prisma.disputeMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
      include: {
        evidence: {
          select: {
            id: true,
            kind: true,
            fileName: true,
            sha256: true
          }
        }
      }
    });
  }

  async message(dealId: string, input: DisputeMessageInput) {
    const deal = await this.ensureDisputeDeal(dealId);
    const actorRole = this.parseActorRole(input.actorRole);
    const body = this.requireBody(input.body);
    await this.ensureEvidence(dealId, input.evidenceId);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.disputeMessage.create({
        data: {
          dealId,
          actorRole,
          messageType: DisputeMessageType.MESSAGE,
          body,
          evidenceId: input.evidenceId || undefined
        },
        include: { evidence: true }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorRole,
          eventType: 'dispute.message_added',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: { messageId: message.id, evidenceId: message.evidenceId }
        }
      });

      return message;
    });
  }

  async proposal(dealId: string, input: DisputeProposalInput) {
    const deal = await this.ensureDisputeDeal(dealId);
    const actorRole = this.parseActorRole(input.actorRole);
    const settlementType = this.parseSettlementType(input.settlementType);
    const body = this.requireBody(input.body);
    const amountKzt = this.resolveProposalAmount(settlementType, input.amountKzt, deal.amountKzt);
    await this.ensureEvidence(dealId, input.evidenceId);

    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.disputeMessage.create({
        data: {
          dealId,
          actorRole,
          messageType: DisputeMessageType.PROPOSAL,
          body,
          settlementType,
          amountKzt,
          evidenceId: input.evidenceId || undefined
        },
        include: { evidence: true }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorRole,
          eventType: 'dispute.proposal_created',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: {
            proposalId: proposal.id,
            settlementType,
            amountKzt,
            evidenceId: proposal.evidenceId
          }
        }
      });

      return proposal;
    });
  }

  async respond(dealId: string, proposalId: string, input: DisputeResponseInput) {
    const deal = await this.ensureDisputeDeal(dealId);
    const actorRole = this.parseActorRole(input.actorRole);
    const decision = input.decision;
    if (decision !== 'ACCEPT' && decision !== 'REJECT') {
      throw new BadRequestException('Decision must be ACCEPT or REJECT');
    }

    const proposal = await this.prisma.disputeMessage.findFirst({
      where: {
        id: proposalId,
        dealId,
        messageType: DisputeMessageType.PROPOSAL
      }
    });
    if (!proposal) throw new NotFoundException('Dispute proposal not found');
    if (proposal.actorRole === actorRole) {
      throw new BadRequestException('Proposal author cannot respond to own proposal');
    }

    const existingResponse = await this.prisma.disputeMessage.findFirst({
      where: {
        dealId,
        proposalId,
        messageType: {
          in: [DisputeMessageType.PROPOSAL_ACCEPTED, DisputeMessageType.PROPOSAL_REJECTED]
        }
      }
    });
    if (existingResponse) throw new BadRequestException('Proposal already has a response');

    const accepted = decision === 'ACCEPT';
    const responseType = accepted
      ? DisputeMessageType.PROPOSAL_ACCEPTED
      : DisputeMessageType.PROPOSAL_REJECTED;
    const body = input.body?.trim() || (accepted ? 'Предложение принято' : 'Предложение отклонено');

    return this.prisma.$transaction(async (tx) => {
      const response = await tx.disputeMessage.create({
        data: {
          dealId,
          actorRole,
          messageType: responseType,
          body,
          settlementType: proposal.settlementType,
          amountKzt: proposal.amountKzt,
          proposalId: proposal.id
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorRole,
          eventType: accepted ? 'dispute.settlement_agreed' : 'dispute.proposal_rejected',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: {
            proposalId: proposal.id,
            responseId: response.id,
            settlementType: proposal.settlementType,
            amountKzt: proposal.amountKzt
          }
        }
      });

      return response;
    });
  }

  private async ensureDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private async ensureDisputeDeal(id: string) {
    const deal = await this.ensureDeal(id);
    if (!disputeStatuses.includes(deal.status)) {
      throw new BadRequestException('Dispute channel is available only after a problem is reported');
    }
    return deal;
  }

  private async ensureEvidence(dealId: string, evidenceId?: string) {
    if (!evidenceId) return;
    const evidence = await this.prisma.evidenceFile.findFirst({
      where: { id: evidenceId, dealId },
      select: { id: true }
    });
    if (!evidence) throw new BadRequestException('Evidence does not belong to this deal');
  }

  private parseActorRole(value?: string) {
    const role = value as DealRole;
    if (!allowedActorRoles.includes(role)) {
      throw new BadRequestException('Actor role must be BUYER, SELLER or ADMIN');
    }
    return role;
  }

  private parseSettlementType(value?: string) {
    const type = value as SettlementType;
    if (!Object.values(SettlementType).includes(type)) {
      throw new BadRequestException('Invalid settlement type');
    }
    return type;
  }

  private requireBody(value?: string) {
    const body = value?.trim();
    if (!body || body.length < 2) throw new BadRequestException('Message is too short');
    if (body.length > 5000) throw new BadRequestException('Message is too long');
    return body;
  }

  private resolveProposalAmount(type: SettlementType, inputAmount: number | undefined, dealAmount: number) {
    if (type === SettlementType.FULL_REFUND || type === SettlementType.RELEASE_TO_SELLER) {
      return dealAmount;
    }
    if (type === SettlementType.CUSTOM && inputAmount === undefined) return undefined;
    if (!Number.isInteger(inputAmount) || (inputAmount ?? 0) <= 0 || (inputAmount ?? 0) > dealAmount) {
      throw new BadRequestException('Settlement amount must be a positive integer not exceeding deal amount');
    }
    return inputAmount;
  }
}
