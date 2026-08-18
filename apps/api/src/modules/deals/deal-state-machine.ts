import { BadRequestException } from '@nestjs/common';
import { DealStatus } from './deal-status.enum';

const allowedTransitions: Record<DealStatus, DealStatus[]> = {
  [DealStatus.DRAFT]: [DealStatus.WAITING_BUYER, DealStatus.CANCELLED],
  [DealStatus.WAITING_BUYER]: [DealStatus.WAITING_PAYMENT, DealStatus.CANCELLED, DealStatus.EXPIRED],
  [DealStatus.WAITING_PAYMENT]: [DealStatus.FUNDS_SECURED, DealStatus.CANCELLED, DealStatus.EXPIRED],
  [DealStatus.FUNDS_SECURED]: [DealStatus.WAITING_SHIPMENT, DealStatus.PROBLEM_REPORTED],
  [DealStatus.WAITING_SHIPMENT]: [DealStatus.SHIPPED, DealStatus.PROBLEM_REPORTED, DealStatus.EXPIRED],
  [DealStatus.SHIPPED]: [DealStatus.DELIVERED, DealStatus.PROBLEM_REPORTED],
  [DealStatus.DELIVERED]: [DealStatus.INSPECTION, DealStatus.PROBLEM_REPORTED],
  [DealStatus.INSPECTION]: [DealStatus.COMPLETED, DealStatus.PROBLEM_REPORTED],
  [DealStatus.PROBLEM_REPORTED]: [DealStatus.WAITING_LEGAL_RESOLUTION, DealStatus.COMPLETED, DealStatus.CANCELLED],
  [DealStatus.WAITING_LEGAL_RESOLUTION]: [DealStatus.COMPLETED, DealStatus.CANCELLED],
  [DealStatus.COMPLETED]: [],
  [DealStatus.CANCELLED]: [],
  [DealStatus.EXPIRED]: []
};

export function assertCanTransition(from: DealStatus, to: DealStatus) {
  if (!allowedTransitions[from]?.includes(to)) {
    throw new BadRequestException(`Invalid deal transition: ${from} -> ${to}`);
  }
}
