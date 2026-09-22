import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DealRole, DealStatus, PartyRole } from '@prisma/client';
import type { PublicUser } from '../auth/auth.service';
import { PhoneAuthService } from '../auth/phone-auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class SecureInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneAuth: PhoneAuthService
  ) {}

  async bindCreatorAndIssue(
    dealId: string,
    creatorRoleInput: string,
    user: PublicUser,
    counterpartyPhoneInput?: string
  ) {
    const userPhone = this.requireVerifiedPhone(user);
    const creatorRole = this.parseRole(creatorRoleInput);
    const recipientPhone = this.phoneAuth.normalizePhone(counterpartyPhoneInput);
    if (recipientPhone === userPhone) {
      throw new BadRequestException('Нельзя пригласить собственный номер');
    }

    const token = this.createToken();
    const tokenHash = this.hashToken(token);
    const shortCode = await this.createUniqueShortCode();
    const expiresAt = this.invitationExpiry();
    const invitedRole = this.oppositeRole(creatorRole);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new NotFoundException('Сделка не найдена');
      if (deal.status !== DealStatus.WAITING_COUNTERPARTY) {
        throw new BadRequestException('Сделка уже не ожидает вторую сторону');
      }
      if (deal.creatorRole !== creatorRole) {
        throw new BadRequestException('Роль создателя сделки не совпадает');
      }
      if (deal.sellerId || deal.buyerId) {
        throw new BadRequestException('Участник сделки уже привязан');
      }

      await tx.dealInvitation.updateMany({
        where: { dealId, claimedAt: null, revokedAt: null },
        data: { revokedAt: now }
      });

      await tx.deal.update({
        where: { id: dealId },
        data: {
          sellerId: creatorRole === PartyRole.SELLER ? user.id : undefined,
          buyerId: creatorRole === PartyRole.BUYER ? user.id : undefined
        }
      });

      await tx.dealInvitation.create({
        data: {
          dealId,
          invitedRole,
          recipientPhone,
          tokenHash,
          shortCode,
          expiresAt
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorId: user.id,
          actorRole: creatorRole === PartyRole.SELLER ? DealRole.SELLER : DealRole.BUYER,
          eventType: 'deal.personal_invitation_issued',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: {
            invitedRole,
            recipientPhoneMasked: this.phoneAuth.maskPhone(recipientPhone),
            expiresAt: expiresAt.toISOString()
          }
        }
      });
    });

    return this.publicInvitation({ invitedRole, recipientPhone, shortCode, expiresAt }, token);
  }

  async listForUser(user: PublicUser) {
    return this.prisma.deal.findMany({
      where: {
        OR: [{ sellerId: user.id }, { buyerId: user.id }]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        publicCode: true,
        title: true,
        amountKzt: true,
        platformFeeKzt: true,
        protectionPlan: true,
        status: true,
        createdAt: true
      }
    });
  }

  async publicPreviewByToken(token: string) {
    const invitation = await this.findByToken(token);
    this.assertUsable(invitation);
    return this.publicPreview(invitation);
  }

  async detailsByToken(token: string, user: PublicUser) {
    const invitation = await this.findByToken(token);
    this.assertUsable(invitation);
    this.assertRecipient(invitation.recipientPhone, user);
    return this.fullPreview(invitation);
  }

  async publicPreviewByCode(code: string) {
    const invitation = await this.findByCode(code);
    this.assertUsable(invitation);
    return this.publicPreview(invitation);
  }

  async detailsByCode(code: string, user: PublicUser) {
    const invitation = await this.findByCode(code);
    this.assertUsable(invitation);
    this.assertRecipient(invitation.recipientPhone, user);
    return this.fullPreview(invitation);
  }

  async claimByToken(token: string, user: PublicUser) {
    const invitation = await this.findByToken(token);
    return this.claim(invitation.id, user);
  }

  async claimByCode(code: string, user: PublicUser) {
    const invitation = await this.findByCode(code);
    return this.claim(invitation.id, user);
  }

  async reissue(dealId: string, counterpartyPhoneInput: string | undefined, user: PublicUser) {
    const userPhone = this.requireVerifiedPhone(user);
    const recipientPhone = this.phoneAuth.normalizePhone(counterpartyPhoneInput);
    if (recipientPhone === userPhone) throw new BadRequestException('Нельзя пригласить собственный номер');

    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    this.assertCreator(deal, user.id);
    if (deal.status !== DealStatus.WAITING_COUNTERPARTY) {
      throw new BadRequestException('После присоединения второй стороны номер изменить нельзя');
    }
    if (!deal.creatorRole) throw new BadRequestException('У сделки не определена роль создателя');

    const token = this.createToken();
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
        data: { dealId, invitedRole, recipientPhone, tokenHash, shortCode, expiresAt }
      });
      await tx.dealEvent.create({
        data: {
          dealId,
          actorId: user.id,
          actorRole: deal.creatorRole === PartyRole.SELLER ? DealRole.SELLER : DealRole.BUYER,
          eventType: 'deal.invitation_reissued',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: {
            invitedRole,
            recipientPhoneMasked: this.phoneAuth.maskPhone(recipientPhone),
            expiresAt: expiresAt.toISOString()
          }
        }
      });
    });

    return this.publicInvitation({ invitedRole, recipientPhone, shortCode, expiresAt }, token);
  }

  async revoke(dealId: string, user: PublicUser) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    this.assertCreator(deal, user.id);
    if (deal.status !== DealStatus.WAITING_COUNTERPARTY) {
      throw new BadRequestException('После присоединения второй стороны приглашение отозвать нельзя');
    }

    const now = new Date();
    const result = await this.prisma.dealInvitation.updateMany({
      where: { dealId, claimedAt: null, revokedAt: null },
      data: { revokedAt: now }
    });

    await this.prisma.dealEvent.create({
      data: {
        dealId,
        actorId: user.id,
        actorRole: deal.creatorRole === PartyRole.BUYER ? DealRole.BUYER : DealRole.SELLER,
        eventType: 'deal.invitation_revoked',
        fromStatus: deal.status,
        toStatus: deal.status,
        payload: { revokedCount: result.count }
      }
    });

    return { ok: true, revokedCount: result.count };
  }

  private async claim(invitationId: string, user: PublicUser) {
    this.requireVerifiedPhone(user);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.dealInvitation.findUnique({
        where: { id: invitationId },
        include: { deal: true }
      });
      if (!invitation) throw new NotFoundException('Приглашение не найдено');
      this.assertUsable(invitation, now);
      this.assertRecipient(invitation.recipientPhone, user);

      const role = invitation.invitedRole;
      const creatorUserId = invitation.deal.creatorRole === PartyRole.SELLER
        ? invitation.deal.sellerId
        : invitation.deal.buyerId;
      if (creatorUserId === user.id) {
        throw new BadRequestException('Один аккаунт не может занимать обе стороны сделки');
      }

      if (role === PartyRole.SELLER && invitation.deal.sellerId) {
        throw new BadRequestException('Роль продавца уже занята');
      }
      if (role === PartyRole.BUYER && invitation.deal.buyerId) {
        throw new BadRequestException('Роль покупателя уже занята');
      }

      await tx.dealInvitation.update({
        where: { id: invitation.id },
        data: { claimedAt: now, claimedByUserId: user.id }
      });

      await tx.dealInvitation.updateMany({
        where: {
          dealId: invitation.dealId,
          id: { not: invitation.id },
          claimedAt: null,
          revokedAt: null
        },
        data: { revokedAt: now }
      });

      await tx.deal.update({
        where: { id: invitation.dealId },
        data: {
          status: DealStatus.WAITING_PAYMENT,
          sellerId: role === PartyRole.SELLER ? user.id : undefined,
          buyerId: role === PartyRole.BUYER ? user.id : undefined,
          acceptedBySellerAt: role === PartyRole.SELLER ? now : undefined,
          acceptedByBuyerAt: role === PartyRole.BUYER ? now : undefined
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId: invitation.dealId,
          actorId: user.id,
          actorRole: role === PartyRole.SELLER ? DealRole.SELLER : DealRole.BUYER,
          eventType: 'deal.counterparty_joined',
          fromStatus: invitation.deal.status,
          toStatus: DealStatus.WAITING_PAYMENT,
          payload: { role, invitationId: invitation.id }
        }
      });

      const deal = await tx.deal.findUnique({
        where: { id: invitation.dealId },
        select: {
          id: true,
          publicCode: true,
          title: true,
          status: true,
          creatorRole: true
        }
      });
      if (!deal) throw new NotFoundException('Сделка не найдена');

      return { role, claimedAt: now, deal };
    });
  }

  private async findByToken(token: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { tokenHash },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Приглашение не найдено');
    return invitation;
  }

  private async findByCode(inputCode: string) {
    const shortCode = this.normalizeShortCode(inputCode);
    const invitation = await this.prisma.dealInvitation.findUnique({
      where: { shortCode },
      include: { deal: true }
    });
    if (!invitation) throw new NotFoundException('Приглашение не найдено');
    return invitation;
  }

  private publicPreview(invitation: Awaited<ReturnType<SecureInvitationsService['findByToken']>>) {
    return {
      invitedRole: invitation.invitedRole,
      shortCode: invitation.shortCode,
      expiresAt: invitation.expiresAt,
      recipientPhoneMasked: invitation.recipientPhone
        ? this.phoneAuth.maskPhone(invitation.recipientPhone)
        : null,
      dealPublicCode: invitation.deal.publicCode,
      requiresPhoneVerification: true
    };
  }

  private fullPreview(invitation: Awaited<ReturnType<SecureInvitationsService['findByToken']>>) {
    return {
      ...this.publicPreview(invitation),
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

  private publicInvitation(
    invitation: { invitedRole: PartyRole; recipientPhone: string; shortCode: string; expiresAt: Date },
    token: string
  ) {
    return {
      invitedRole: invitation.invitedRole,
      recipientPhoneMasked: this.phoneAuth.maskPhone(invitation.recipientPhone),
      shortCode: invitation.shortCode,
      token,
      expiresAt: invitation.expiresAt
    };
  }

  private assertUsable(
    invitation: {
      claimedAt: Date | null;
      revokedAt: Date | null;
      expiresAt: Date;
      deal: { status: DealStatus };
    },
    now = new Date()
  ) {
    if (invitation.revokedAt) throw new BadRequestException('Приглашение отозвано');
    if (invitation.claimedAt) throw new BadRequestException('Приглашение уже использовано');
    if (invitation.expiresAt <= now) throw new BadRequestException('Срок приглашения истёк');
    if (invitation.deal.status !== DealStatus.WAITING_COUNTERPARTY) {
      throw new BadRequestException('Сделка уже не ожидает вторую сторону');
    }
  }

  private assertRecipient(recipientPhone: string | null, user: PublicUser) {
    const userPhone = this.requireVerifiedPhone(user);
    if (!recipientPhone) {
      throw new BadRequestException('Старое приглашение не привязано к номеру. Попросите отправить новое');
    }
    if (recipientPhone !== userPhone) {
      throw new ForbiddenException(
        `Это приглашение предназначено для ${this.phoneAuth.maskPhone(recipientPhone)}`
      );
    }
  }

  private assertCreator(
    deal: { creatorRole: PartyRole | null; sellerId: string | null; buyerId: string | null },
    userId: string
  ) {
    const isCreator = deal.creatorRole === PartyRole.SELLER
      ? deal.sellerId === userId
      : deal.creatorRole === PartyRole.BUYER
        ? deal.buyerId === userId
        : false;
    if (!isCreator) throw new ForbiddenException('Только создатель сделки может менять приглашение');
  }

  private requireVerifiedPhone(user: PublicUser) {
    if (!user.phone) throw new ForbiddenException('Для этой операции войдите по подтверждённому телефону');
    return this.phoneAuth.normalizePhone(user.phone);
  }

  private parseRole(value: string) {
    if (value === PartyRole.SELLER) return PartyRole.SELLER;
    if (value === PartyRole.BUYER) return PartyRole.BUYER;
    throw new BadRequestException('Роль должна быть SELLER или BUYER');
  }

  private oppositeRole(role: PartyRole) {
    return role === PartyRole.SELLER ? PartyRole.BUYER : PartyRole.SELLER;
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
    throw new BadRequestException('Не удалось сформировать уникальный код приглашения');
  }

  private normalizeShortCode(value: string) {
    const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 8) throw new BadRequestException('Код приглашения должен содержать 8 символов');
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  private createToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    const value = String(token ?? '').trim();
    if (!value) throw new BadRequestException('Токен приглашения обязателен');
    return createHash('sha256').update(value).digest('hex');
  }

  private invitationExpiry() {
    const ttlHours = Number(process.env.DEAL_INVITE_TTL_HOURS ?? 72);
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }
}
