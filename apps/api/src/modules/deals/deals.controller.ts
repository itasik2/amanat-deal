import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PartyRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user';
import type { PublicUser } from '../auth/auth.service';
import { PhoneAuthService } from '../auth/phone-auth.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DealAccessService } from './deal-access.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealsService } from './deals.service';
import { InspectionAutomationService } from './inspection-automation.service';
import { SecureInvitationsService } from './secure-invitations.service';

@Controller('deals')
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly secureInvitations: SecureInvitationsService,
    private readonly phoneAuth: PhoneAuthService,
    private readonly access: DealAccessService,
    private readonly inspections: InspectionAutomationService
  ) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(@Body() dto: CreateDealDto, @CurrentUser() user: PublicUser) {
    if (!user.phone) {
      throw new ForbiddenException('Для создания сделки войдите по подтверждённому телефону');
    }
    const creatorPhone = this.phoneAuth.normalizePhone(user.phone);
    const counterpartyPhone = this.phoneAuth.normalizePhone(dto.counterpartyPhone);
    if (creatorPhone === counterpartyPhone) {
      throw new ForbiddenException('Нельзя пригласить собственный номер');
    }

    const created = await this.deals.create(dto, user.id);
    const invitation = await this.secureInvitations.bindCreatorAndIssue(
      created.id,
      dto.creatorRole,
      user,
      counterpartyPhone
    );
    return { ...created, invitation };
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async list(@CurrentUser() user: PublicUser) {
    await this.inspections.reconcileUser(user.id);
    return this.secureInvitations.listForUser(user);
  }

  @Post('join-by-code')
  joinByCode(@Body() body: { code: string }) {
    return this.secureInvitations.publicPreviewByCode(body.code);
  }

  @Post('join-by-code/details')
  @UseGuards(SessionAuthGuard)
  joinByCodeDetails(@Body() body: { code: string }, @CurrentUser() user: PublicUser) {
    return this.secureInvitations.detailsByCode(body.code, user);
  }

  @Post('join-by-code/claim')
  @UseGuards(SessionAuthGuard)
  claimByCode(@Body() body: { code: string }, @CurrentUser() user: PublicUser) {
    return this.secureInvitations.claimByCode(body.code, user);
  }

  @Get(':id')
  @UseGuards(SessionAuthGuard)
  async get(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    const currentUserRole = await this.access.roleForUser(id, user.id);
    await this.inspections.reconcileDeal(id);
    const deal = await this.deals.get(id);
    return { ...deal, currentUserRole };
  }

  @Post(':id/accept')
  @UseGuards(SessionAuthGuard)
  async accept(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    const role = await this.access.roleForUser(id, user.id);
    return this.deals.accept(id, { userId: user.id, role });
  }

  @Post(':id/invitations/reissue')
  @UseGuards(SessionAuthGuard)
  reissueInvitation(
    @Param('id') id: string,
    @Body() body: { counterpartyPhone?: string },
    @CurrentUser() user: PublicUser
  ) {
    return this.secureInvitations.reissue(id, body.counterpartyPhone, user);
  }

  @Post(':id/invitations/revoke')
  @UseGuards(SessionAuthGuard)
  revokeInvitation(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.secureInvitations.revoke(id, user);
  }

  @Post(':id/mock-payment')
  @UseGuards(SessionAuthGuard)
  async mockPayment(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.requireRole(id, user.id, PartyRole.BUYER);
    return this.deals.mockPayment(id);
  }

  @Post(':id/shipment')
  @UseGuards(SessionAuthGuard)
  async shipment(
    @Param('id') id: string,
    @Body() body: { carrier?: string; trackingNumber?: string },
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.requireRole(id, user.id, PartyRole.SELLER);
    return this.deals.markShipped(id, body, { userId: user.id, role });
  }

  @Post(':id/mark-delivered')
  @UseGuards(SessionAuthGuard)
  async markDelivered(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    const role = await this.access.requireRole(id, user.id, PartyRole.BUYER);
    return this.deals.markDelivered(id, { userId: user.id, role });
  }

  @Post(':id/confirm-receipt')
  @UseGuards(SessionAuthGuard)
  async confirmReceipt(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    const role = await this.access.requireRole(id, user.id, PartyRole.BUYER);
    if (await this.inspections.reconcileDeal(id)) return this.deals.get(id);
    return this.deals.complete(id, 'buyer_confirmed', { userId: user.id, role });
  }

  @Post(':id/report-problem')
  @UseGuards(SessionAuthGuard)
  async reportProblem(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: PublicUser
  ) {
    const role = await this.access.roleForUser(id, user.id);
    if (await this.inspections.reconcileDeal(id)) {
      throw new BadRequestException('Срок проверки уже истёк; сделка завершена автоматически');
    }
    return this.deals.reportProblem(id, body.reason, { userId: user.id, role });
  }

  @Get(':id/events')
  @UseGuards(SessionAuthGuard)
  async events(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.access.roleForUser(id, user.id);
    await this.inspections.reconcileDeal(id);
    return this.deals.events(id);
  }
}
