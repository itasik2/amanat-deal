import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealExtensionType, DealRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtensionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dealId: string) {
    await this.ensureDeal(dealId);
    return this.prisma.dealExtension.findMany({
      where: { dealId },
      orderBy: { enabledAt: 'asc' }
    });
  }

  async enable(dealId: string, typeValue: string, actorRoleValue?: string) {
    const deal = await this.ensureDeal(dealId);
    const type = this.parseType(typeValue);
    const actorRole = this.parseRole(actorRoleValue);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dealExtension.findUnique({
        where: { dealId_type: { dealId, type } }
      });
      if (existing) return existing;

      const extension = await tx.dealExtension.create({
        data: {
          dealId,
          type,
          enabledByRole: actorRole
        }
      });

      await tx.dealEvent.create({
        data: {
          dealId,
          actorRole,
          eventType: 'extension.enabled',
          fromStatus: deal.status,
          toStatus: deal.status,
          payload: { type }
        }
      });

      return extension;
    });
  }

  async isEnabled(dealId: string, type: DealExtensionType) {
    const extension = await this.prisma.dealExtension.findUnique({
      where: { dealId_type: { dealId, type } },
      select: { id: true }
    });
    return Boolean(extension);
  }

  private async ensureDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private parseType(value: string) {
    const normalized = value.toUpperCase() as DealExtensionType;
    if (!Object.values(DealExtensionType).includes(normalized)) {
      throw new BadRequestException('Unknown deal extension');
    }
    return normalized;
  }

  private parseRole(value?: string) {
    const role = (value || DealRole.SYSTEM) as DealRole;
    if (!Object.values(DealRole).includes(role)) {
      throw new BadRequestException('Invalid actor role');
    }
    return role;
  }
}
