import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PartyRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DealAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async roleForUser(dealId: string, userId: string): Promise<PartyRole> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        sellerId: true,
        buyerId: true
      }
    });

    if (!deal) throw new NotFoundException('Сделка не найдена');
    if (deal.sellerId === userId) return PartyRole.SELLER;
    if (deal.buyerId === userId) return PartyRole.BUYER;

    throw new ForbiddenException('Нет доступа к этой сделке');
  }

  async requireRole(
    dealId: string,
    userId: string,
    allowed: PartyRole | PartyRole[]
  ): Promise<PartyRole> {
    const role = await this.roleForUser(dealId, userId);
    const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException('Эта операция недоступна для вашей роли в сделке');
    }

    return role;
  }
}
