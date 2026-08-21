import { DealCategory, DealRole, ProtectionPlan } from '@prisma/client';

export type ProtectionStage = 'PRE_SHIPMENT' | 'RECEIPT';

export type EvidenceSnapshot = {
  uploaderRole: DealRole;
  kind: string;
};

type ChecklistDefinition = {
  key: string;
  label: string;
  role: DealRole;
  kind: string;
  stage: ProtectionStage;
  extendedOnly?: boolean;
};

const rules: Record<DealCategory, ChecklistDefinition[]> = {
  GOODS: [
    { key: 'seller-condition', label: 'Фото состояния товара перед отправкой', role: DealRole.SELLER, kind: 'PHOTO', stage: 'PRE_SHIPMENT' },
    { key: 'seller-packaging', label: 'Фото упаковки перед отправкой', role: DealRole.SELLER, kind: 'PACKAGING', stage: 'PRE_SHIPMENT', extendedOnly: true },
    { key: 'buyer-condition', label: 'Фото состояния товара после получения', role: DealRole.BUYER, kind: 'PHOTO', stage: 'RECEIPT' },
    { key: 'buyer-unboxing', label: 'Видео распаковки', role: DealRole.BUYER, kind: 'VIDEO', stage: 'RECEIPT', extendedOnly: true }
  ],
  EQUIPMENT: [
    { key: 'seller-condition', label: 'Фото состояния оборудования перед отправкой', role: DealRole.SELLER, kind: 'PHOTO', stage: 'PRE_SHIPMENT' },
    { key: 'seller-serial', label: 'Серийный номер / шильдик оборудования', role: DealRole.SELLER, kind: 'SERIAL_NUMBER', stage: 'PRE_SHIPMENT' },
    { key: 'seller-packaging', label: 'Фото упаковки оборудования', role: DealRole.SELLER, kind: 'PACKAGING', stage: 'PRE_SHIPMENT', extendedOnly: true },
    { key: 'buyer-condition', label: 'Фото состояния оборудования после получения', role: DealRole.BUYER, kind: 'PHOTO', stage: 'RECEIPT' },
    { key: 'buyer-serial', label: 'Сверка серийного номера / шильдика', role: DealRole.BUYER, kind: 'SERIAL_NUMBER', stage: 'RECEIPT', extendedOnly: true }
  ],
  REPAIR: [
    { key: 'seller-result', label: 'Фото результата ремонта', role: DealRole.SELLER, kind: 'PHOTO', stage: 'PRE_SHIPMENT' },
    { key: 'seller-act', label: 'Акт или описание выполненных работ', role: DealRole.SELLER, kind: 'DOCUMENT', stage: 'PRE_SHIPMENT', extendedOnly: true },
    { key: 'buyer-result', label: 'Фото результата после получения', role: DealRole.BUYER, kind: 'PHOTO', stage: 'RECEIPT' },
    { key: 'buyer-check', label: 'Документ / подтверждение проверки результата', role: DealRole.BUYER, kind: 'DOCUMENT', stage: 'RECEIPT', extendedOnly: true }
  ],
  SERVICE: [
    { key: 'seller-result', label: 'Документ или файл, подтверждающий результат услуги', role: DealRole.SELLER, kind: 'DOCUMENT', stage: 'PRE_SHIPMENT' },
    { key: 'buyer-acceptance', label: 'Подтверждение проверки результата услуги', role: DealRole.BUYER, kind: 'DOCUMENT', stage: 'RECEIPT' },
    { key: 'seller-extra', label: 'Дополнительный материал о выполнении услуги', role: DealRole.SELLER, kind: 'PHOTO', stage: 'PRE_SHIPMENT', extendedOnly: true }
  ],
  OTHER: [
    { key: 'seller-state', label: 'Материал, фиксирующий состояние или результат до передачи', role: DealRole.SELLER, kind: 'PHOTO', stage: 'PRE_SHIPMENT' },
    { key: 'buyer-state', label: 'Материал, фиксирующий состояние или результат после получения', role: DealRole.BUYER, kind: 'PHOTO', stage: 'RECEIPT' }
  ]
};

export function buildProtectionChecklist(
  category: DealCategory,
  protectionPlan: ProtectionPlan,
  evidence: EvidenceSnapshot[]
) {
  const definitions = rules[category].filter(
    (item) => protectionPlan === ProtectionPlan.EXTENDED || !item.extendedOnly
  );

  const items = definitions.map((item) => ({
    ...item,
    required: protectionPlan === ProtectionPlan.EXTENDED,
    satisfied: evidence.some(
      (file) => file.uploaderRole === item.role && file.kind.toUpperCase() === item.kind
    )
  }));

  return {
    protectionPlan,
    category,
    required: protectionPlan === ProtectionPlan.EXTENDED,
    complete: items.every((item) => item.satisfied),
    items
  };
}

export function missingRequiredEvidence(
  category: DealCategory,
  protectionPlan: ProtectionPlan,
  evidence: EvidenceSnapshot[],
  stage: ProtectionStage
) {
  if (protectionPlan !== ProtectionPlan.EXTENDED) return [];
  return buildProtectionChecklist(category, protectionPlan, evidence).items.filter(
    (item) => item.stage === stage && !item.satisfied
  );
}
