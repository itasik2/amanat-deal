'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EvidencePanel } from './EvidencePanel';
import { DisputePanel } from './DisputePanel';

type DealSummary = {
  id: string;
  status: string;
  amountKzt: number;
};

type DealExtension = {
  id: string;
  type: string;
};

export function DealExtras() {
  const params = useParams<{ id: string }>();
  const dealId = params.id;
  const [deal, setDeal] = useState<DealSummary | null>(null);
  const [extensions, setExtensions] = useState<DealExtension[]>([]);

  const load = useCallback(async () => {
    if (!dealId) return;
    const [dealResponse, extensionsResponse] = await Promise.all([
      fetch(`/api/backend/deals/${dealId}`, { cache: 'no-store' }),
      fetch(`/api/backend/deals/${dealId}/extensions`, { cache: 'no-store' })
    ]);
    if (dealResponse.ok) setDeal((await dealResponse.json()) as DealSummary);
    if (extensionsResponse.ok) setExtensions((await extensionsResponse.json()) as DealExtension[]);
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!dealId) return null;

  const evidenceEnabled = extensions.some((item) => item.type === 'EVIDENCE');

  return (
    <div className="page deal-extras">
      <EvidencePanel
        dealId={dealId}
        enabled={evidenceEnabled}
        onChanged={() => void load()}
        onEnabled={() => void load()}
      />
      {deal ? (
        <DisputePanel
          dealId={dealId}
          dealStatus={deal.status}
          dealAmountKzt={deal.amountKzt}
          evidenceEnabled={evidenceEnabled}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}
