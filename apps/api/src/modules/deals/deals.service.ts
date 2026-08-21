import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DealCategory,
  DealRole,
  DealStatus as PrismaDealStatus,
  DisputeMessageType,
  PartyRole,
  Prisma,
  ProtectionPlan
} from '@prisma/client';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealStatus } from './deal-status.enum';
import { assertCanTransition } from './deal-state-machine';
import { missingRequiredEvidence, ProtectionStage } from '../evidence/protection-checklist';
import { PrismaService } from '../prisma/prisma.service';

const dealInclude = {
  payments: true,
  deliveries: true,
  evidence: true,
  disputeAssistance: true
} satisfies Prisma.DealInclude;

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDealDto) {
    const protectionPlan = (dto.protectionPlan ?? ProtectionPlan.BASIC) as ProtectionPlan;
    const creatorRole = dto.creatorRole as PartyRole;
    const invitedRole = this.oppositeRole(creatorRole);
    const fee = this.calculateFee(dto.amountKzt, protectionPlan);
    const inspectionHours = dto.inspectionHours ?? Number(process.env.DEFAULT_INSPECTION_HOURS ?? 48);
    const status = this.toPrismaStatus(DealStatus.WAITING_COUNTERPARTY);
    const token = this.createInviteToken();
    const tokenHash = this.hashToken(token);
    const shortCode = await this.createUniqueShortCode();
    const expiresAt = this.invitationExpiry();
    const acceptedAt = new Date();

    const deal = await this.prisma.deal.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category as DealCategory,
        amountKzt: dto.amountKzt,
        platformFeeKzt: fee,
        protectionPlan,
        creatorRole,
        inspectionHours,
        status,
        acceptedBySellerAt: creatorRole === PartyRole.SELLER ? acceptedAt : undefined,
        acceptedByBuyerAt: creatorRole === PartyRole.BUYER ? acceptedAt : undefined,
        invitations: {
          create: {
            invitedRole,
            tokenHash,
            shortCode,
            expiresAt
          }
        },
        events: {
          create: [
            this.eventData('deal.created', undefined, status, {
              title: dto.title,
              protectionPlan,
              creatorRole
            }),
            this.eventData('deal.invitation_created', status, status, {
              invitedRole,
              shortCode,
              expiresAt: expiresAt.toISOString()
            })
          ]
        }
      },
      include: dealInclude
    });

    return {
      ...deal,
      invitation: this.publicInvitation({ invitedRole, shortCode, expiresAt }, token)
    };
  }

  async list() {
    return this.prisma.deal.findMany({
      orderBy: { createdAt: 'desc' },
      include: dealInclude
    });
  }

  async get(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: dealInclude
    });

    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async accept(id: string, actorRoleInput?: string) {
    const role = this.parsePartyRole(actorRoleInput ?? 'BUYER');
    const now = new Date();

    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');

    // Existing pilot deals predate creatorRole. Preserve their old one-click buyer acceptance flow.
    if (!deal.creatorRole) {
      return this.transition(id, DealStatus.WAITING_PAYMENT, 'deal.accepted', { actorRole: role }, {
        acceptedByBuyerAt: role === PartyRole.BUYER ? now : undefined,
        acceptedBySellerAt: role === PartyRole.SELLER ? now : undefined
      });
    }

    if (deal.status !== this.toPrismaStatus(DealStatus.WAITING_COUNTERPARTY)) {
      throw new BadRequestException('Deal is not waiting for the counterparty');
    }

    const alreadyAccepted = role === PartyRole.SELLER ? deal.acceptedBySellerAt : deal.acceptedByBuyerAt;
    if (alreadyAccepted) return this.get(id);

    const sellerAccepted = Boolean(deal.acceptedBySellerAt) || role === PartyRole.SELLER;
    const buyerAccepted = Boolean(deal.acceptedByBuyerAt) || role === PartyRole.BUYER;
    const readyForPayment = sellerAccepted && buyerAccepted;
    const nextStatus = readyForPayment
      ? this.toPrismaStatus(DealStatus.WAITING_PAYMENT)
      : deal.status;

    if (readyForPayment) {
      assertCanTransition(this.toLocalStatus(deal.status), DealStatus.WAITING_PAYMENT);
    }

    await this.prisma.deal.update({
      where: { id },
      data: {
        acceptedBySellerAt: role === PartyRole.SELLER ? now : undefined,
        acceptedByBuyerAt: role === PartyRole.BUYER ? now : undefined,
        status: nextStatus,
        events: {
          create: this.eventData(
            readyForPayment ? 'deal.accepted' : 'deal.party_accepted',
            deal.status,
            nextStatus,
            { actorRole: role }
          )
        }
      }
    });

    return this.get(id);
  }

  async invitationPreview(token: string) {
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    this.assertInvitationUsable(invitation);
    return this.invitationPreviewPayload(invitation);
  }

  async invitationPreviewByCode(inputCode: string) {
    const shortCode = this.normalizeShortCode(inputCode);
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { shortCode },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    this.assertInvitationUsable(invitation);
    return this.invitationPreviewPayload(invitation);
  }

  async claimInvitation(token: string) {
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    return this.claimInvitationRecord(invitation.id);
  }

  async claimInvitationByCode(inputCode: string) {
    const shortCode = this.normalizeShortCode(inputCode);
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { shortCode },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    return this.claimInvitationRecord(invitation.id);
  }

  async reissueInvitation(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Deal not found');
    if (!deal.creatorRole) throw new BadRequestException('Legacy deal does not support invitations');
    if (deal.status !== this.toPrismaStatus(DealStatus.WAITING_COUNTERPARTY)) {
      throw new BadRequestException('Invitation can be reissued only while waiting for the counterparty');
    }

    const token = this.createInviteToken();
    const tokenHash = this.hashToken(token);
    const shortCode = await this.createUniqueShortCode();
    const expiresAt = this.invitationExpiry();
    const invitedRole = this.oppositeRole(deal.creatorRole);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.dealInvitation.updateMany({
        where: { dealId, claimedAt: null, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.dealInvitation.create({
        data: { dealId, invitedRole, tokenHash, shortCode, expiresAt }
      });
      await tx.dealEvent.create({
        data: {
          dealId,
          ...this.eventData('deal.invitation_reissued', deal.status, deal.status, {
            invitedRole,
            shortCode,
            expiresAt: expiresAt.toISOString()
          })
        }
      });
    });

    return this.publicInvitation({ invitedRole, shortCode, expiresAt }, token);
  }

  async mockPayment(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const deal = await this.findDealOrThrow(tx, id);
      const fundsSecured = this.toPrismaStatus(DealStatus.FUNDS_SECURED);
      assertCanTransition(this.toLocalStatus(deal.status), DealStatus.FUNDS_SECURED);

      await tx.deal.update({
        where: { id },
        data: {
          status: fundsSecured,
          fundsSecuredAt: new Date(),
          payments: {
            create: {
              provider: 'mock-escrow',
              externalReference: `mock-${id}-${Date.now()}`,
              amountKzt: deal.amountKzt,
              platformFeeKzt: deal.platformFeeKzt,
              status: 'FUNDS_SECURED'
            }
          },
          events: {
            create: this.eventData('mock_escrow.funds_secured', deal.status, fundsSecured, {
              provider: 'mock-escrow'
            })
          }
        }
      });

      const readyForShipment = this.toPrismaStatus(DealStatus.WAITING_SHIPMENT);
      assertCanTransition(DealStatus.FUNDS_SECURED, DealStatus.WAITING_SHIPMENT);

      await tx.deal.update({
        where: { id },
        data: {
          status: readyForShipment,
          events: {
            create: this.eventData('deal.ready_for_shipment', fundsSecured, readyForShipment)
          }
        }
      });
    });

    return this.get(id);
  }

  async markShipped(id: string, shipment: { carrier?: string; trackingNumber?: string }) {
    await this.assertProtectionEvidence(id, 'PRE_SHIPMENT');
    const shippedStatus = this.toPrismaStatus(DealStatus.SHIPPED);

    await this.prisma.$transaction(async (tx) => {
      const deal = await this.findDealOrThrow(tx, id);
      assertCanTransition(this.toLocalStatus(deal.status), DealStatus.SHIPPED);

      await tx.deal.update({
        where: { id },
        data: {
          status: shippedStatus,
          shippedAt: new Date(),
          deliveries: {
            create: {
              carrier: shipment.carrier,
              trackingNumber: shipment.trackingNumber,
              status: 'SHIPPED'
            }
          },
          events: {
            create: this.eventData('shipment.added', deal.status, shippedStatus, shipment)
          }
        }
      });
    });

    return this.get(id);
  }

  async markDelivered(id: string) {
    const deliveredAt = new Date();

    await this.transition(id, DealStatus.DELIVERED, 'delivery.delivered', undefined, {
      deliveredAt,
      deliveries: {
        updateMany: {
          where: { dealId: id },
          data: {
            status: 'DELIVERED',
            deliveredAt
          }
        }
      }
    });

    const delivered = await this.get(id);
    const inspectionEndsAt = new Date(Date.now() + delivered.inspectionHours * 60 * 60 * 1000);

    return this.transition(
      id,
      DealStatus.INSPECTION,
      'inspection.started',
      { inspectionEndsAt: inspectionEndsAt.toISOString() },
      { inspectionEndsAt }
    );
  }

  async complete(id: string, reason: string) {
    if (reason === 'buyer_confirmed') {
      await this.assertProtectionEvidence(id, 'RECEIPT');
    }
    return this.transition(id, DealStatus.COMPLETED, 'mock_escrow.release_to_seller', { reason }, {
      completedAt: new Date()
    });
  }

  async reportProblem(id: string, reason: string) {
    const summary = reason?.trim();
    if (!summary || summary.length < 3) {
      throw new BadRequestException('Problem reason is too short');
    }

    const problemStatus = this.toPrismaStatus(DealStatus.PROBLEM_REPORTED);

    await this.prisma.$transaction(async (tx) => {
      const deal = await this.findDealOrThrow(tx, id);
      assertCanTransition(this.toLocalStatus(deal.status), DealStatus.PROBLEM_REPORTED);

      await tx.deal.update({
        where: { id },
        data: {
          status: problemStatus,
          events: {
            create: this.eventData('problem.reported', deal.status, problemStatus, { reason: summary })
          }
        }
      });

      await tx.disputeMessage.create({
        data: {
          dealId: id,
          actorRole: DealRole.SYSTEM,
          messageType: DisputeMessageType.SYSTEM,
          body: `Проблема зафиксирована: ${summary}`
        }
      });
    });

    return this.get(id);
  }

  async events(id: string) {
    await this.get(id);
    return this.prisma.dealEvent.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async claimInvitationRecord(invitationId: string) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.dealInvitation.findUnique({
        where: { id: invitationId },
        include: { deal: true }
      });
      if (!invitation) throw new NotFoundException('Invitation not found');
      this.assertInvitationUsable(invitation, now);

      const claimed = await tx.dealInvitation.updateMany({
        where: {
          id: invitation.id,
          claimedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: { claimedAt: now }
      });
      if (claimed.count !== 1) throw new BadRequestException('Invitation is no longer available');

      await tx.dealEvent.create({
        data: {
          dealId: invitation.dealId,
          actorRole: DealRole.SYSTEM,
          eventType: 'deal.invitation_claimed',
          fromStatus: invitation.deal.status,
          toStatus: invitation.deal.status,
          payload: {
            invitedRole: invitation.invitedRole,
            shortCode: invitation.shortCode
          }
        }
      });

      const deal = await tx.deal.findUnique({
        where: { id: invitation.dealId },
        include: dealInclude
      });
      if (!deal) throw new NotFoundException('Deal not found');

      return {
        role: invitation.invitedRole,
        claimedAt: now,
        deal
      };
    });
  }

  private invitationPreviewPayload(invitation: {
    invitedRole: PartyRole;
    shortCode: string;
    expiresAt: Date;
    deal: {
      id: string;
      publicCode: string;
      title: string;
      description: string;
      category: DealCategory;
      amountKzt: number;
      platformFeeKzt: number;
      protectionPlan: ProtectionPlan;
      inspectionHours: number;
      status: PrismaDealStatus;
      creatorRole: PartyRole | null;
    };
  }) {
    return {
      invitedRole: invitation.invitedRole,
      shortCode: invitation.shortCode,
      expiresAt: invitation.expiresAt,
      deal: {
        id: invitation.deal.id,
        publicCode: invitation.deal.publicCode,
        title: invitation.deal.title,
        description: invitation.deal.description,
        category: invitation.deal.category,
        amountKzt: invitation.deal.amountKzt,
        platformFeeKzt: invitation.deal.platformFeeKzt,
        protectionPlan: invitation.deal.protectionPlan,
        inspectionHours: invitation.deal.inspectionHours,
        status: invitation.deal.status,
        creatorRole: invitation.deal.creatorRole
      }
    };
  }

  private assertInvitationUsable(
    invitation: { claimedAt: Date | null; revokedAt: Date | null; expiresAt: Date; deal: { status: PrismaDealStatus } },
    now = new Date()
  ) {
    if (invitation.revokedAt) throw new BadRequestException('Invitation has been revoked');
    if (invitation.claimedAt) throw new BadRequestException('Invitation has already been used');
    if (invitation.expiresAt <= now) throw new BadRequestException('Invitation has expired');
    if (invitation.deal.status !== this.toPrismaStatus(DealStatus.WAITING_COUNTERPARTY)) {
      throw new BadRequestException('Deal is no longer waiting for a counterparty');
    }
  }

  private publicInvitation(
    invitation: { invitedRole: PartyRole; shortCode: string; expiresAt: Date },
    token: string
  ) {
    return {
      invitedRole: invitation.invitedRole,
      shortCode: invitation.shortCode,
      token,
      expiresAt: invitation.expiresAt
    };
  }

  private async createUniqueShortCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const raw = Array.from({ length: 8 }, () => {
        const index = randomBytes(1)[0] % SHORT_CODE_ALPHABET.length;
        return SHORT_CODE_ALPHABET[index];
      }).join('');
      const shortCode = `${raw.slice(0, 4)}-${raw.slice(4)}`;
      const exists = await this.prisma.dealInvitation.findUnique({
        where: { shortCode },
        select: { id: true }
      });
      if (!exists) return shortCode;
    }
    throw new BadRequestException('Could not allocate a unique invitation code');
  }

  private normalizeShortCode(value: string) {
    const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 8) throw new BadRequestException('Invitation code must contain 8 characters');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  private createInviteToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    const value = String(token ?? '').trim();
    if (!value) throw new BadRequestException('Invitation token is required');
    return createHash('sha256').update(value).digest('hex');
  }

  private invitationExpiry() {
    const ttlHours = Number(process.env.DEAL_INVITE_TTL_HOURS ?? 72);
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private oppositeRole(role: PartyRole) {
    return role === PartyRole.SELLER ? PartyRole.BUYER : PartyRole.SELLER;
  }

  private parsePartyRole(value: string) {
    if (value === PartyRole.SELLER) return PartyRole.SELLER;
    if (value === PartyRole.BUYER) return PartyRole.BUYER;
    throw new BadRequestException('Party role must be SELLER or BUYER');
  }

  private async assertProtectionEvidence(id: string, stage: ProtectionStage) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        protectionPlan: true,
        evidence: {
          select: {
            uploaderRole: true,
            kind: true
          }
        }
      }
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const missing = missingRequiredEvidence(
      deal.category,
      deal.protectionPlan,
      deal.evidence,
      stage
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Расширенная защита: добавьте обязательные доказательства: ${missing.map((item) => item.label).join('; ')}`
      );
    }
  }

  private async transition(
    id: string,
    nextStatus: DealStatus,
    eventType: string,
    payload?: unknown,
    data: Prisma.DealUpdateInput = {}
  ) {
    const prismaStatus = this.toPrismaStatus(nextStatus);

    await this.prisma.$transaction(async (tx) => {
      const deal = await this.findDealOrThrow(tx, id);
      assertCanTransition(this.toLocalStatus(deal.status), nextStatus);

      await tx.deal.update({
        where: { id },
        data: {
          ...data,
          status: prismaStatus,
          events: {
            create: this.eventData(eventType, deal.status, prismaStatus, payload)
          }
        }
      });
    });

    return this.get(id);
  }

  private async findDealOrThrow(tx: Prisma.TransactionClient, id: string) {
    const deal = await tx.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private eventData(
    eventType: string,
    fromStatus?: PrismaDealStatus,
    toStatus?: PrismaDealStatus,
    payload?: unknown
  ): Prisma.DealEventCreateWithoutDealInput {
    const data: Prisma.DealEventCreateWithoutDealInput = {
      actorRole: DealRole.SYSTEM,
      eventType,
      fromStatus,
      toStatus
    };

    if (payload !== undefined) {
      data.payload = payload as Prisma.InputJsonValue;
    }

    return data;
  }

  private toLocalStatus(status: PrismaDealStatus) {
    return status as unknown as DealStatus;
  }

  private toPrismaStatus(status: DealStatus) {
    return status as unknown as PrismaDealStatus;
  }

  private calculateFee(amountKzt: number, protectionPlan: ProtectionPlan) {
    const percent = Number(
      protectionPlan === ProtectionPlan.EXTENDED
        ? process.env.EXTENDED_PROTECTION_FEE_PERCENT ?? 3
        : process.env.PLATFORM_FEE_PERCENT ?? 2
    );
    const min = Number(process.env.PLATFORM_FEE_MIN_KZT ?? 500);
    const max = Number(process.env.PLATFORM_FEE_MAX_KZT ?? 20000);
    return Math.min(max, Math.max(min, Math.round((amountKzt * percent) / 100)));
  }
}
