export enum DealStatus {
  DRAFT = 'DRAFT',
  WAITING_BUYER = 'WAITING_BUYER',
  WAITING_PAYMENT = 'WAITING_PAYMENT',
  FUNDS_SECURED = 'FUNDS_SECURED',
  WAITING_SHIPMENT = 'WAITING_SHIPMENT',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  INSPECTION = 'INSPECTION',
  COMPLETED = 'COMPLETED',
  PROBLEM_REPORTED = 'PROBLEM_REPORTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  WAITING_LEGAL_RESOLUTION = 'WAITING_LEGAL_RESOLUTION'
}

export enum DealCategory {
  GOODS = 'GOODS',
  SERVICE = 'SERVICE',
  REPAIR = 'REPAIR',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER'
}

export type MoneyKzt = number;

export interface DealSummary {
  id: string;
  title: string;
  category: DealCategory;
  amountKzt: MoneyKzt;
  platformFeeKzt: MoneyKzt;
  status: DealStatus;
  inspectionHours: number;
}
