import { Injectable } from '@nestjs/common';
import { DealRole, DealStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DueInspection = {
  id: string;
  inspectionEndsAt: Date | null;
};

@Injectable()
export class InspectionAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileDeal(dealId: string, now = new Date()) {
    return this.completeIfDue({ id: dealId, inspectionEndsAt: null }, now);
  }

  async reconcileUser(userId: string, now = new Date(), limit = 50) {
    const candidates = await this.prisma.deal.findMany({
      where: {
        status: DealStatus.INSPECTION,
        inspectionEndsAt: { lte: now },
        OR: [{ sellerId: userId }, { buyerId: userId }]
      },
      select: { id: true, inspectionEndsAt: true },
      orderBy: { inspectionEndsAt: 'asc' },
      take: limit
    });

    return this.processCandidates(candidates, now);
  }

  async completeExpiredInspections(now = new Date(), limit = 100) {
    const candidates = await this.prisma.deal.findMany({
      where: {
        status: DealStatus.INSPECTION,
        inspectionEndsAt: { lte: now }
      },
      select: { id: true, inspectionEndsAt: true },
      orderBy: { inspectionEndsAt: 'asc' },
      take: limit
    });

    return this.processCandidates(candidates, now);
  }

  private async processCandidates(candidates: DueInspection[], now: Date) {
    let completed = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        if (await this.completeIfDue(candidate, now)) completed += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        console.error('Failed to auto-complete expired Amanat inspection', {
          dealId: candidate.id,
          error
        });
      }
    }

    return {
      checked: candidates.length,
      completed,
      skipped,
      failed,
      processedAt: now.toISOString(),
      hasMore: candidates.length >= 100
    };
  }

  private async completeIfDue(candidate: DueInspection, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const current = candidate.inspectionEndsAt
        ? candidate
        : await tx.deal.findUnique({
            where: { id: candidate.id },
            select: { id: true, inspectionEndsAt: true }
          });

      if (!current?.inspectionEndsAt || current.inspectionEndsAt > now) return false;

      const updated = await tx.deal.updateMany({
        where: {
          id: current.id,
          status: DealStatus.INSPECTION,
          inspectionEndsAt: { lte: now }
        },
        data: {
          status: DealStatus.COMPLETED,
          completedAt: now
        }
      });

      if (updated.count === 0) return false;

      await tx.payment.updateMany({
        where: {
          dealId: current.id,
          status: 'FUNDS_SECURED'
        },
        data: { status: 'RELEASED' }
      });

      await tx.dealEvent.create({
        data: {
          dealId: current.id,
          actorRole: DealRole.SYSTEM,
          eventType: 'inspection.expired',
          fromStatus: DealStatus.INSPECTION,
          toStatus: DealStatus.COMPLETED,
          payload: {
            reason: 'inspection_expired',
            inspectionEndsAt: current.inspectionEndsAt.toISOString(),
            paymentAction: 'release_to_seller'
          }
        }
      });

      return true;
    });
  }
}
