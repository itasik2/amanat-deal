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

export function DealExtras() {
  const params = useParams<{ id: string }>();
  const dealId = params.id;
  const [deal, setDeal] = useState<DealSummary | null>(null);

  const load = useCallback(async () => {
    if (!dealId) return;
    const response = await fetch(`/api/backend/deals/${dealId}`, { cache: 'no-store' });
    if (response.ok) setDeal((await response.json()) as DealSummary);
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!dealId) return null;

  return (
    <div className="page deal-extras">
      <EvidencePanel dealId={dealId} onChanged={() => void load()} />
      {deal ? (
        <DisputePanel
          dealId={dealId}
          dealStatus={deal.status}
          dealAmountKzt={deal.amountKzt}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}
