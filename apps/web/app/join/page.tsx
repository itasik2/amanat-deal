'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    amountKzt: number;
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

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const response = await fetch('/api/backend/deals/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!response.ok) throw new Error(await apiError(response));
      setPreview((await response.json()) as InvitationPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось найти приглашение');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/backend/deals/join-by-code/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: preview.shortCode })
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json() as { role: PartyRole; deal: { id: string } };
      router.push(`/deal/${result.deal.id}?role=${result.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <div className="page-header">
        <Link className="back-link" href="/">← На главную</Link>
        <span className="pill">Присоединение</span>
      </div>

      <section className="card">
        <p className="eyebrow">Код приглашения</p>
        <h1>Присоединиться к сделке</h1>
        <p className="muted">Введите короткий код, который прислал второй участник. Просмотр условий сам по себе не занимает роль.</p>

        <form className="form" onSubmit={lookup}>
          <label className="field">
            <span>Код сделки</span>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD-EFGH" autoComplete="off" />
          </label>
          <button className="button" disabled={busy} type="submit">{busy ? 'Проверяем…' : 'Показать условия'}</button>
        </form>

        {error ? <div className="notice error spacing-top">{error}</div> : null}
      </section>

      {preview ? (
        <section className="card spacing-top">
          <p className="eyebrow">{preview.deal.publicCode}</p>
          <h2>{preview.deal.title}</h2>
          <p>{preview.deal.description}</p>
          <dl className="facts">
            <div><dt>Ваша роль</dt><dd>{roleLabel(preview.invitedRole)}</dd></div>
            <div><dt>Сумма</dt><dd>{money(preview.deal.amountKzt)}</dd></div>
            <div><dt>Защита</dt><dd>{preview.deal.protectionPlan === 'EXTENDED' ? 'Расширенная' : 'Базовая'}</dd></div>
            <div><dt>Проверка</dt><dd>{preview.deal.inspectionHours} ч.</dd></div>
          </dl>
          <div className="notice warning spacing-top-small">После присоединения эта роль будет занята. Следующим шагом вы отдельно примете условия сделки.</div>
          <button className="button spacing-top" disabled={busy} onClick={() => void claim()}>{busy ? 'Присоединяем…' : `Присоединиться как ${roleLabel(preview.invitedRole)}`}</button>
        </section>
      ) : null}
    </main>
  );
}
