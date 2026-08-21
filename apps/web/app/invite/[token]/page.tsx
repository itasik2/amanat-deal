'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type PartyRole = 'SELLER' | 'BUYER';

type InvitationPreview = {
  invitedRole: PartyRole;
  shortCode: string;
  expiresAt: string;
  deal: {
    id: string;
    publicCode: string;
    title: string;
    description: string;
    category: string;
    amountKzt: number;
    platformFeeKzt: number;
    protectionPlan: 'BASIC' | 'EXTENDED';
    inspectionHours: number;
    creatorRole: PartyRole | null;
  };
};

function money(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₸';
}

function roleLabel(role: PartyRole) {
  return role === 'SELLER' ? 'продавец' : 'покупатель';
}

async function apiError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.message || `Ошибка API: ${response.status}`;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(`/api/backend/deal-invitations/${encodeURIComponent(token)}/preview`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await apiError(response));
      setPreview((await response.json()) as InvitationPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть приглашение');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/backend/deal-invitations/${encodeURIComponent(token)}/claim`, { method: 'POST' });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json() as { role: PartyRole; deal: { id: string } };
      router.push(`/deal/${result.deal.id}?role=${result.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="page narrow"><div className="card">Проверяем приглашение…</div></main>;
  }

  if (!preview) {
    return (
      <main className="page narrow">
        <section className="card">
          <p className="eyebrow">Приглашение</p>
          <h1>Ссылка недоступна</h1>
          <div className="notice error">{error || 'Приглашение не найдено, истекло или уже использовано.'}</div>
          <div className="actions spacing-top"><Link className="button secondary" href="/join">Ввести короткий код</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <div className="page-header">
        <Link className="back-link" href="/">← Amanat Deal</Link>
        <span className="pill">Защищённое приглашение</span>
      </div>

      <section className="card hero-card">
        <p className="eyebrow">Сделка · {preview.deal.publicCode}</p>
        <h1>Вас пригласили как {roleLabel(preview.invitedRole)}</h1>
        <p className="lead">Сначала проверьте условия. Только после нажатия «Присоединиться» роль будет занята за этой сессией пилота.</p>

        <div className="card inset-card spacing-top-small">
          <h2>{preview.deal.title}</h2>
          <p>{preview.deal.description}</p>
          <dl className="facts">
            <div><dt>Сумма</dt><dd>{money(preview.deal.amountKzt)}</dd></div>
            <div><dt>Комиссия платформы</dt><dd>{money(preview.deal.platformFeeKzt)}</dd></div>
            <div><dt>Защита</dt><dd>{preview.deal.protectionPlan === 'EXTENDED' ? 'Расширенная' : 'Базовая'}</dd></div>
            <div><dt>Срок проверки</dt><dd>{preview.deal.inspectionHours} ч.</dd></div>
            <div><dt>Резервный код</dt><dd>{preview.shortCode}</dd></div>
          </dl>
        </div>

        <div className="notice warning spacing-top-small">
          Присоединение ещё не запускает оплату. После входа вы отдельно подтвердите условия сделки своей стороной.
        </div>

        {error ? <div className="notice error spacing-top-small">{error}</div> : null}

        <div className="actions spacing-top">
          <button className="button" disabled={busy} onClick={() => void claim()}>{busy ? 'Присоединяем…' : `Присоединиться как ${roleLabel(preview.invitedRole)}`}</button>
          <Link className="button secondary" href="/">Отказаться</Link>
        </div>
      </section>
    </main>
  );
}
