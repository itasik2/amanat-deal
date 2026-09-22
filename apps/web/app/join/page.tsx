'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type PartyRole = 'SELLER' | 'BUYER';

type PublicInvitationPreview = {
  invitedRole: PartyRole;
  shortCode: string;
  expiresAt: string;
  recipientPhoneMasked: string | null;
  dealPublicCode: string;
  requiresPhoneVerification: boolean;
};

type InvitationDetails = PublicInvitationPreview & {
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
  const [preview, setPreview] = useState<PublicInvitationPreview | null>(null);
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedCode = new URLSearchParams(window.location.search).get('code');
    if (savedCode) setCode(savedCode.toUpperCase());
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    setBusy(true);
    setError('');
    setPreview(null);
    setDetails(null);
    setNeedsLogin(false);

    try {
      const previewResponse = await fetch('/api/backend/deals/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode })
      });
      if (!previewResponse.ok) throw new Error(await apiError(previewResponse));
      const publicPreview = await previewResponse.json() as PublicInvitationPreview;
      setPreview(publicPreview);
      setCode(publicPreview.shortCode);

      const detailsResponse = await fetch('/api/backend/deals/join-by-code/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: publicPreview.shortCode })
      });

      if (detailsResponse.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!detailsResponse.ok) throw new Error(await apiError(detailsResponse));
      setDetails(await detailsResponse.json() as InvitationDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось найти приглашение');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!details) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/backend/deals/join-by-code/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: details.shortCode })
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json() as { role: PartyRole; deal: { id: string } };
      router.push(`/deal/${result.deal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться');
    } finally {
      setBusy(false);
    }
  }

  const loginNext = preview
    ? `/join?code=${encodeURIComponent(preview.shortCode)}`
    : '/join';

  return (
    <main className="page narrow">
      <div className="page-header">
        <Link className="back-link" href="/">← На главную</Link>
        <span className="pill">Присоединение</span>
      </div>

      <section className="card">
        <p className="eyebrow">Код приглашения</p>
        <h1>Присоединиться к сделке</h1>
        <p className="muted">Введите короткий код. До подтверждения привязанного номера условия сделки не раскрываются.</p>

        <form className="form" onSubmit={lookup}>
          <label className="field">
            <span>Код сделки</span>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD-EFGH" autoComplete="off" />
          </label>
          <button className="button" disabled={busy} type="submit">{busy ? 'Проверяем…' : 'Проверить код'}</button>
        </form>

        {error ? <div className="notice error spacing-top">{error}</div> : null}
      </section>

      {preview && !details ? (
        <section className="card spacing-top">
          <p className="eyebrow">Сделка · {preview.dealPublicCode}</p>
          <h2>Приглашение найдено</h2>
          <dl className="facts">
            <div><dt>Ваша роль</dt><dd>{roleLabel(preview.invitedRole)}</dd></div>
            <div><dt>Привязанный номер</dt><dd>{preview.recipientPhoneMasked || 'не указан'}</dd></div>
          </dl>
          <div className="notice warning spacing-top-small">
            Условия доступны только владельцу указанного номера после SMS-подтверждения. Если код попал к вам по ошибке, принять сделку вы не сможете.
          </div>
          {needsLogin ? (
            <div className="actions spacing-top">
              <Link className="button" href={`/login?next=${encodeURIComponent(loginNext)}`}>Войти по номеру</Link>
              <Link className="button secondary" href="/">Отказаться</Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {details ? (
        <section className="card spacing-top">
          <p className="eyebrow">{details.deal.publicCode}</p>
          <h2>{details.deal.title}</h2>
          <p>{details.deal.description}</p>
          <dl className="facts">
            <div><dt>Ваша роль</dt><dd>{roleLabel(details.invitedRole)}</dd></div>
            <div><dt>Сумма</dt><dd>{money(details.deal.amountKzt)}</dd></div>
            <div><dt>Защита</dt><dd>{details.deal.protectionPlan === 'EXTENDED' ? 'Расширенная' : 'Базовая'}</dd></div>
            <div><dt>Проверка</dt><dd>{details.deal.inspectionHours} ч.</dd></div>
          </dl>
          <div className="notice warning spacing-top-small">После присоединения эта роль фиксируется за вашим аккаунтом в данной сделке.</div>
          <div className="actions spacing-top">
            <button className="button" disabled={busy} onClick={() => void claim()}>{busy ? 'Присоединяем…' : `Присоединиться как ${roleLabel(details.invitedRole)}`}</button>
            <Link className="button secondary" href="/">Отказаться</Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
