import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealStatus } from './deal-status.enum';
import { assertCanTransition } from './deal-state-machine';

type Deal = {
  id: string;
  title: string;
  description: string;
  category: string;
  amountKzt: number;
  platformFeeKzt: number;
  inspectionHours: number;
  status: DealStatus;
  carrier?: string;
  trackingNumber?: string;
  inspectionEndsAt?: string;
  createdAt: string;
};

type DealEvent = {
  id: string;
  dealId: string;
  eventType: string;
  fromStatus?: DealStatus;
  toStatus?: DealStatus;
  payload?: unknown;
  createdAt: string;
};

@Injectable()
export class DealsService {
  private readonly deals = new Map<string, Deal>();
  private readonly dealEvents = new Map<string, DealEvent[]>();

  create(dto: CreateDealDto) {
    const fee = this.calculateFee(dto.amountKzt);
    const deal: Deal = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      category: dto.category,
      amountKzt: dto.amountKzt,
      platformFeeKzt: fee,
      inspectionHours: dto.inspectionHours ?? Number(process.env.DEFAULT_INSPECTION_HOURS ?? 48),
      status: DealStatus.WAITING_BUYER,
      createdAt: new Date().toISOString()
    };
    this.deals.set(deal.id, deal);
    this.addEvent(deal.id, 'deal.created', undefined, deal.status, { title: deal.title });
    return deal;
  }

  list() {
    return Array.from(this.deals.values());
  }

  get(id: string) {
    const deal = this.deals.get(id);
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  accept(id: string) {
    return this.transition(id, DealStatus.WAITING_PAYMENT, 'deal.accepted');
  }

  mockPayment(id: string) {
    const secured = this.transition(id, DealStatus.FUNDS_SECURED, 'mock_escrow.funds_secured');
    return this.transition(secured.id, DealStatus.WAITING_SHIPMENT, 'deal.ready_for_shipment');
  }

  markShipped(id: string, shipment: { carrier?: string; trackingNumber?: string }) {
    const deal = this.get(id);
    assertCanTransition(deal.status, DealStatus.SHIPPED);
    const updated = { ...deal, ...shipment, status: DealStatus.SHIPPED };
    this.deals.set(id, updated);
    this.addEvent(id, 'shipment.added', deal.status, updated.status, shipment);
    return updated;
  }

  markDelivered(id: string) {
    const delivered = this.transition(id, DealStatus.DELIVERED, 'delivery.delivered');
    const inspectionEndsAt = new Date(Date.now() + delivered.inspectionHours * 60 * 60 * 1000).toISOString();
    const inspection = { ...delivered, status: DealStatus.INSPECTION, inspectionEndsAt };
    assertCanTransition(delivered.status, inspection.status);
    this.deals.set(id, inspection);
    this.addEvent(id, 'inspection.started', delivered.status, inspection.status, { inspectionEndsAt });
    return inspection;
  }

  complete(id: string, reason: string) {
    return this.transition(id, DealStatus.COMPLETED, 'mock_escrow.release_to_seller', { reason });
  }

  reportProblem(id: string, reason: string) {
    return this.transition(id, DealStatus.PROBLEM_REPORTED, 'problem.reported', { reason });
  }

  events(id: string) {
    this.get(id);
    return this.dealEvents.get(id) ?? [];
  }

  private transition(id: string, nextStatus: DealStatus, eventType: string, payload?: unknown) {
    const deal = this.get(id);
    assertCanTransition(deal.status, nextStatus);
    const updated = { ...deal, status: nextStatus };
    this.deals.set(id, updated);
    this.addEvent(id, eventType, deal.status, nextStatus, payload);
    return updated;
  }

  private addEvent(dealId: string, eventType: string, fromStatus?: DealStatus, toStatus?: DealStatus, payload?: unknown) {
    const event: DealEvent = {
      id: randomUUID(),
      dealId,
      eventType,
      fromStatus,
      toStatus,
      payload,
      createdAt: new Date().toISOString()
    };
    this.dealEvents.set(dealId, [...(this.dealEvents.get(dealId) ?? []), event]);
  }

  private calculateFee(amountKzt: number) {
    const percent = Number(process.env.PLATFORM_FEE_PERCENT ?? 2);
    const min = Number(process.env.PLATFORM_FEE_MIN_KZT ?? 500);
    const max = Number(process.env.PLATFORM_FEE_MAX_KZT ?? 20000);
    return Math.min(max, Math.max(min, Math.round((amountKzt * percent) / 100)));
  }
}
