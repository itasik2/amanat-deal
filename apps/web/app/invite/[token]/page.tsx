'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  const [preview, setPreview] = useState<PublicInvitationPreview | null>(null);
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setNeedsLogin(false);
    try {
      const publicResponse = await fetch(`/api/backend/deal-invitations/${encodeURIComponent(token)}/preview`, { cache: 'no-store' });
      if (!publicResponse.ok) throw new Error(await apiError(publicResponse));
      const publicPreview = await publicResponse.json() as PublicInvitationPreview;
      setPreview(publicPreview);

      const detailsResponse = await fetch(`/api/backend/deal-invitations/${encodeURIComponent(token)}/details`, { cache: 'no-store' });
      if (detailsResponse.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!detailsResponse.ok) throw new Error(await apiError(detailsResponse));
      setDetails(await detailsResponse.json() as InvitationDetails);
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
    if (!details) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/backend/deal-invitations/${encodeURIComponent(token)}/claim`, { method: 'POST' });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json() as { role: PartyRole; deal: { id: string } };
      router.push(`/deal/${result.deal.id}`);
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

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="page narrow">
      <div className="page-header">
        <Link className="back-link" href="/">← Amanat Deal</Link>
        <span className="pill">Защищённое приглашение</span>
      </div>

      <section className="card hero-card">
        <p className="eyebrow">Сделка · {preview.dealPublicCode}</p>
        <h1>Вас пригласили как {roleLabel(preview.invitedRole)}</h1>

        {!details ? (
          <>
            <p className="lead">
              Условия сделки откроются только после подтверждения номера {preview.recipientPhoneMasked || 'контрагента'}.
            </p>
            <div className="notice warning spacing-top-small">
              Если приглашение пришло вам по ошибке, ничего делать не нужно. Войти с другим номером и занять роль второй стороны нельзя.
            </div>
            {needsLogin ? (
              <div className="actions spacing-top">
                <Link className="button" href={loginHref}>Войти по номеру и посмотреть условия</Link>
                <Link className="button secondary" href="/">Отказаться</Link>
              </div>
            ) : null}
            {error ? <div className="notice error spacing-top-small">{error}</div> : null}
          </>
        ) : (
          <>
            <p className="lead">Номер подтверждён. Проверьте условия сделки перед присоединением.</p>

            <div className="card inset-card spacing-top-small">
              <h2>{details.deal.title}</h2>
              <p>{details.deal.description}</p>
              <dl className="facts">
                <div><dt>Сумма</dt><dd>{money(details.deal.amountKzt)}</dd></div>
                <div><dt>Комиссия платформы</dt><dd>{money(details.deal.platformFeeKzt)}</dd></div>
                <div><dt>Защита</dt><dd>{details.deal.protectionPlan === 'EXTENDED' ? 'Расширенная' : 'Базовая'}</dd></div>
                <div><dt>Срок проверки</dt><dd>{details.deal.inspectionHours} ч.</dd></div>
                <div><dt>Резервный код</dt><dd>{details.shortCode}</dd></div>
              </dl>
            </div>

            <div className="notice warning spacing-top-small">
              После присоединения ваш аккаунт будет зафиксирован как {roleLabel(details.invitedRole)} в этой сделке. Заменить сторону тихо задним числом нельзя.
            </div>

            {error ? <div className="notice error spacing-top-small">{error}</div> : null}

            <div className="actions spacing-top">
              <button className="button" disabled={busy} onClick={() => void claim()}>{busy ? 'Присоединяем…' : `Присоединиться как ${roleLabel(details.invitedRole)}`}</button>
              <Link className="button secondary" href="/">Отказаться</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
