'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Payment = {
  id: string;
  provider: string;
  amountKzt: number;
  platformFeeKzt: number;
  status: string;
};

type Delivery = {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
  deliveredAt: string | null;
};

type Deal = {
  id: string;
  publicCode: string;
  title: string;
  description: string;
  category: string;
  amountKzt: number;
  platformFeeKzt: number;
  protectionPlan: 'BASIC' | 'EXTENDED';
  inspectionHours: number;
  status: string;
  fundsSecuredAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  inspectionEndsAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payments: Payment[];
  deliveries: Delivery[];
};

type DealEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  payload: unknown;
};

const statusLabels: Record<string, string> = {
  WAITING_BUYER: 'Ожидает принятия покупателем',
  WAITING_PAYMENT: 'Ожидает оплаты',
  FUNDS_SECURED: 'Средства зарезервированы',
  WAITING_SHIPMENT: 'Ожидает отправки',
  SHIPPED: 'Отправлено',
  DELIVERED: 'Доставлено',
  INSPECTION: 'Срок проверки',
  COMPLETED: 'Завершено',
  PROBLEM_REPORTED: 'Сообщено о проблеме',
  CANCELLED: 'Отменено',
  EXPIRED: 'Истекло',
  WAITING_LEGAL_RESOLUTION: 'Ожидает урегулирования'
};

const protectionLabels: Record<string, string> = {
  BASIC: 'Базовая защита',
  EXTENDED: 'Расширенная защита'
};

const eventLabels: Record<string, string> = {
  'deal.created': 'Сделка создана',
  'deal.accepted': 'Условия приняты',
  'mock_escrow.funds_secured': 'Mock-escrow зарезервировал средства',
  'deal.ready_for_shipment': 'Сделка готова к отправке',
  'shipment.added': 'Добавлена отправка',
  'delivery.delivered': 'Доставка подтверждена',
  'inspection.started': 'Начался срок проверки',
  'mock_escrow.release_to_seller': 'Mock-выплата продавцу',
  'problem.reported': 'Зафиксирована проблема',
  'evidence.uploaded': 'Добавлено доказательство',
  'dispute.assistance_requested': 'Запрошено сопровождение спора',
  'dispute.settlement_agreed': 'Стороны зафиксировали соглашение'
};

function money(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₸';
}

function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

async function apiError(response: Response) {
  const body = await response.json().catch(() => null);
  if (body && typeof body.message === 'string') return body.message;
  if (body && Array.isArray(body.message)) return body.message.join(', ');
  return `Ошибка API: ${response.status}`;
}

export default function DealPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [carrier, setCarrier] = useState('QazPost');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [problemReason, setProblemReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [dealResponse, eventsResponse] = await Promise.all([
        fetch(`/api/backend/deals/${id}`, { cache: 'no-store' }),
        fetch(`/api/backend/deals/${id}/events`, { cache: 'no-store' })
      ]);

      if (!dealResponse.ok) throw new Error(await apiError(dealResponse));
      if (!eventsResponse.ok) throw new Error(await apiError(eventsResponse));

      setDeal((await dealResponse.json()) as Deal);
      setEvents((await eventsResponse.json()) as DealEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сделку');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body?: unknown) {
    setActing(true);
    setError('');
    try {
      const response = await fetch(`/api/backend/deals/${id}/${path}`, {
        method: 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await apiError(response));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Действие не выполнено');
    } finally {
      setActing(false);
    }
  }

  async function submitShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await post('shipment', {
      carrier: carrier.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined
    });
  }

  async function submitProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (problemReason.trim().length < 3) {
      setError('Опишите проблему хотя бы несколькими словами');
      return;
    }
    await post('report-problem', { reason: problemReason.trim() });
  }

  if (loading) {
    return <main className="page"><div className="card">Загружаем сделку…</div></main>;
  }

  if (!deal) {
    return (
      <main className="page narrow">
        <div className="card">
          <h1>Сделка не загружена</h1>
          <p className="notice error">{error || 'Проверьте идентификатор сделки и доступность API.'}</p>
          <Link className="button secondary" href="/">На главную</Link>
        </div>
      </main>
    );
  }

  const delivery = deal.deliveries.at(-1);
  const payment = deal.payments.at(-1);
  const canReportProblem = ['WAITING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'INSPECTION'].includes(deal.status);

  return (
    <main className="page">
      <div className="page-header">
        <Link className="back-link" href="/">← Все сделки</Link>
        <span className={`status status-${deal.status.toLowerCase()}`}>{statusLabels[deal.status] ?? deal.status}</span>
      </div>

      {error ? <div className="notice error spacing-bottom">{error}</div> : null}

      <section className="card hero-card">
        <div className="deal-title-row">
          <div>
            <p className="eyebrow">Сделка · {deal.publicCode}</p>
            <h1>{deal.title}</h1>
          </div>
          <div className="amount-block">
            <strong>{money(deal.amountKzt)}</strong>
            <span>{protectionLabels[deal.protectionPlan] ?? deal.protectionPlan} · комиссия {money(deal.platformFeeKzt)}</span>
          </div>
        </div>
        <p className="deal-description">{deal.description}</p>
        <div className="meta-grid">
          <div><span>Категория</span><strong>{deal.category}</strong></div>
          <div><span>Защита</span><strong>{protectionLabels[deal.protectionPlan] ?? deal.protectionPlan}</strong></div>
          <div><span>Срок проверки</span><strong>{deal.inspectionHours} ч.</strong></div>
          <div><span>Создана</span><strong>{dateTime(deal.createdAt)}</strong></div>
          <div><span>Проверка до</span><strong>{dateTime(deal.inspectionEndsAt)}</strong></div>
        </div>
      </section>

      <div className="two-column spacing-top">
        <section className="card">
          <p className="eyebrow">Следующее действие</p>
          <h2>{statusLabels[deal.status] ?? deal.status}</h2>

          {deal.status === 'WAITING_BUYER' ? (
            <>
              <p className="muted">В пилоте эта кнопка имитирует принятие условий второй стороной.</p>
              <button className="button" disabled={acting} onClick={() => void post('accept')}>Принять условия</button>
            </>
          ) : null}

          {deal.status === 'WAITING_PAYMENT' ? (
            <>
              <p className="muted">Реальных денег пока нет. Mock-escrow создаст платёж и зафиксирует резервирование.</p>
              <button className="button" disabled={acting} onClick={() => void post('mock-payment')}>Mock-оплата</button>
            </>
          ) : null}

          {deal.status === 'WAITING_SHIPMENT' ? (
            <form className="form" onSubmit={submitShipment}>
              <label className="field">
                <span>Перевозчик</span>
                <input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="QazPost" />
              </label>
              <label className="field">
                <span>Трек-номер</span>
                <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="TEST123456KZ" />
              </label>
              <button className="button" disabled={acting} type="submit">Зафиксировать отправку</button>
            </form>
          ) : null}

          {deal.status === 'SHIPPED' ? (
            <>
              <p className="muted">Для пилота доставка подтверждается вручную. Позже это событие должен давать API перевозчика.</p>
              <button className="button" disabled={acting} onClick={() => void post('mark-delivered')}>Отметить доставленным</button>
            </>
          ) : null}

          {deal.status === 'INSPECTION' ? (
            <>
              <p className="muted">Покупатель проверяет предмет сделки до {dateTime(deal.inspectionEndsAt)}.</p>
              <button className="button" disabled={acting} onClick={() => void post('confirm-receipt')}>Подтвердить получение</button>
            </>
          ) : null}

          {deal.status === 'COMPLETED' ? (
            <div className="notice success">Сделка завершена. В mock-режиме выплата продавцу зафиксирована в истории.</div>
          ) : null}

          {deal.status === 'PROBLEM_REPORTED' ? (
            <div className="notice warning">Выплата остановлена. Проблема зафиксирована для дальнейшего урегулирования.</div>
          ) : null}

          {canReportProblem ? (
            <details className="problem-box">
              <summary>Сообщить о проблеме</summary>
              <form className="form compact" onSubmit={submitProblem}>
                <label className="field">
                  <span>Что не соответствует условиям?</span>
                  <textarea rows={3} value={problemReason} onChange={(event) => setProblemReason(event.target.value)} placeholder="Опишите конкретное нарушение условий сделки" />
                </label>
                <button className="button danger" disabled={acting} type="submit">Зафиксировать проблему</button>
              </form>
            </details>
          ) : null}
        </section>

        <section className="card">
          <p className="eyebrow">Расчёты и доставка</p>
          <h2>Текущее состояние</h2>
          <dl className="facts">
            <div><dt>Mock-escrow</dt><dd>{payment ? payment.status : 'Нет платежа'}</dd></div>
            <div><dt>Резервирование</dt><dd>{dateTime(deal.fundsSecuredAt)}</dd></div>
            <div><dt>Перевозчик</dt><dd>{delivery?.carrier || '—'}</dd></div>
            <div><dt>Трек-номер</dt><dd>{delivery?.trackingNumber || '—'}</dd></div>
            <div><dt>Доставка</dt><dd>{delivery?.status || '—'}</dd></div>
            <div><dt>Завершение</dt><dd>{dateTime(deal.completedAt)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>История сделки</h2>
          </div>
          <button className="text-button" onClick={() => void load()} disabled={acting}>Обновить</button>
        </div>
        <div className="timeline">
          {events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <span className="timeline-dot" />
              <div>
                <strong>{eventLabels[event.eventType] ?? event.eventType}</strong>
                <p className="muted small">
                  {dateTime(event.createdAt)} · {event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus || 'без смены статуса'}
                </p>
              </div>
            </div>
          ))}
          {events.length === 0 ? <p className="muted">Событий пока нет.</p> : null}
        </div>
      </section>
    </main>
  );
}
