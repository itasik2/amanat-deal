import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DealCategory,
  DealRole,
  DealStatus as PrismaDealStatus,
  DisputeMessageType,
  Prisma
} from '@prisma/client';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealStatus } from './deal-status.enum';
import { assertCanTransition } from './deal-state-machine';
import { PrismaService } from '../prisma/prisma.service';

const dealInclude = {
  payments: true,
  deliveries: true,
  evidence: true
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDealDto) {
    const fee = this.calculateFee(dto.amountKzt);
    const inspectionHours = dto.inspectionHours ?? Number(process.env.DEFAULT_INSPECTION_HOURS ?? 48);
    const status = this.toPrismaStatus(DealStatus.WAITING_BUYER);

    return this.prisma.deal.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category as DealCategory,
        amountKzt: dto.amountKzt,
        platformFeeKzt: fee,
        inspectionHours,
        status,
        events: {
          create: this.eventData('deal.created', undefined, status, { title: dto.title })
        }
      },
      include: dealInclude
    });
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

  async accept(id: string) {
    return this.transition(id, DealStatus.WAITING_PAYMENT, 'deal.accepted', undefined, {
      acceptedByBuyerAt: new Date()
    });
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

  private calculateFee(amountKzt: number) {
    const percent = Number(process.env.PLATFORM_FEE_PERCENT ?? 2);
    const min = Number(process.env.PLATFORM_FEE_MIN_KZT ?? 500);
    const max = Number(process.env.PLATFORM_FEE_MAX_KZT ?? 20000);
    return Math.min(max, Math.max(min, Math.round((amountKzt * percent) / 100)));
  }
}
