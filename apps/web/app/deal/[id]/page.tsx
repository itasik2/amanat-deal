'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EvidencePanel } from './EvidencePanel';
import { DisputePanel } from './DisputePanel';

type DealRole = 'SELLER' | 'BUYER' | 'ADMIN';

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
  'dispute.message_added': 'Добавлено сообщение в споре',
  'dispute.proposal_created': 'Создано предложение урегулирования',
  'dispute.proposal_rejected': 'Предложение урегулирования отклонено',
  'dispute.assistance_requested': 'Запрошено сопровождение спора',
  'dispute.settlement_agreed': 'Стороны зафиксировали соглашение'
};

function roleLabel(role: DealRole) {
  if (role === 'SELLER') return 'Продавец';
  if (role === 'BUYER') return 'Покупатель';
  return 'Админ';
}

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
  const [activeRole, setActiveRole] = useState<DealRole>('SELLER');
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

  useEffect(() => {
    setProblemReason('');
    setError('');
  }, [activeRole]);

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
  const canReportProblem = activeRole !== 'ADMIN' && ['WAITING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'INSPECTION'].includes(deal.status);

  function roleAction(currentDeal: Deal) {
    if (activeRole === 'ADMIN') {
      return (
        <div className="role-waiting admin-context">
          <strong>Режим оператора.</strong>
          <span>Админ контролирует статус, оплату, доставку, доказательства, историю и спор, но не выполняет действия за покупателя или продавца.</span>
        </div>
      );
    }

    if (currentDeal.status === 'COMPLETED') {
      return <div className="notice success">Сделка завершена. Выплата продавцу зафиксирована в истории.</div>;
    }

    if (currentDeal.status === 'PROBLEM_REPORTED' || currentDeal.status === 'WAITING_LEGAL_RESOLUTION') {
      return <div className="notice warning">Обычный ход сделки остановлен. Ниже доступен общий канал урегулирования.</div>;
    }

    if (activeRole === 'BUYER') {
      if (currentDeal.status === 'WAITING_BUYER') {
        return (
          <>
            <p className="muted">Проверьте условия сделки. После принятия станет доступен этап оплаты.</p>
            <button className="button" disabled={acting} onClick={() => void post('accept')}>Принять условия</button>
          </>
        );
      }
      if (currentDeal.status === 'WAITING_PAYMENT') {
        return (
          <>
            <p className="muted">В пилоте реальный банк ещё не подключён. Кнопка имитирует резервирование средств покупателя.</p>
            <button className="button" disabled={acting} onClick={() => void post('mock-payment')}>Mock-оплата</button>
          </>
        );
      }
      if (currentDeal.status === 'WAITING_SHIPMENT') {
        return <div className="role-waiting"><strong>Ваше действие пока не требуется.</strong><span>Продавец должен добавить обязательные материалы и зафиксировать отправку.</span></div>;
      }
      if (currentDeal.status === 'SHIPPED') {
        return (
          <>
            <p className="muted">В пилоте покупатель вручную подтверждает факт доставки. Позже это событие должен давать перевозчик.</p>
            <button className="button" disabled={acting} onClick={() => void post('mark-delivered')}>Подтвердить доставку</button>
          </>
        );
      }
      if (currentDeal.status === 'INSPECTION') {
        return (
          <>
            <p className="muted">Проверьте предмет сделки до {dateTime(currentDeal.inspectionEndsAt)} и закройте свой чек-лист доказательств.</p>
            <button className="button" disabled={acting} onClick={() => void post('confirm-receipt')}>Подтвердить получение</button>
          </>
        );
      }
    }

    if (activeRole === 'SELLER') {
      if (currentDeal.status === 'WAITING_BUYER') {
        return <div className="role-waiting"><strong>Ждём покупателя.</strong><span>Покупатель должен принять условия сделки.</span></div>;
      }
      if (currentDeal.status === 'WAITING_PAYMENT') {
        return <div className="role-waiting"><strong>Ждём оплату.</strong><span>После резервирования средств продавцу откроется этап отправки.</span></div>;
      }
      if (currentDeal.status === 'WAITING_SHIPMENT') {
        return (
          <form className="form" onSubmit={submitShipment}>
            <p className="muted">Перед отправкой закройте обязательные пункты своего чек-листа ниже.</p>
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
        );
      }
      if (currentDeal.status === 'SHIPPED') {
        return <div className="role-waiting"><strong>Отправка зафиксирована.</strong><span>Теперь ждём подтверждения доставки покупателем или перевозчиком.</span></div>;
      }
      if (currentDeal.status === 'INSPECTION') {
        return <div className="role-waiting"><strong>Покупатель проверяет результат.</strong><span>До завершения проверки средства остаются защищены условиями сделки.</span></div>;
      }
    }

    return <div className="role-waiting"><strong>Ожидаем следующий этап.</strong><span>Текущий статус: {statusLabels[currentDeal.status] ?? currentDeal.status}.</span></div>;
  }

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

      <section className="card role-switch-card spacing-top">
        <div>
          <p className="eyebrow">Пилотный стенд ролей</p>
          <h2>Просмотр сделки</h2>
          <p className="muted">Сейчас можно переключать три роли для тестирования. В рабочей версии пользователь увидит только свою роль, а админ будет работать в отдельном кабинете.</p>
        </div>
        <div className="role-tabs" role="tablist" aria-label="Режим просмотра сделки">
          <button className={`role-tab ${activeRole === 'SELLER' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeRole === 'SELLER'} onClick={() => setActiveRole('SELLER')}>
            <span>Продавец</span>
            <small>Доказательства · отправка · ожидание выплаты</small>
          </button>
          <button className={`role-tab ${activeRole === 'BUYER' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeRole === 'BUYER'} onClick={() => setActiveRole('BUYER')}>
            <span>Покупатель</span>
            <small>Принятие · оплата · получение · проверка</small>
          </button>
          <button className={`role-tab ${activeRole === 'ADMIN' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeRole === 'ADMIN'} onClick={() => setActiveRole('ADMIN')}>
            <span>Админ</span>
            <small>Контроль · аудит · доказательства · спор</small>
          </button>
        </div>
      </section>

      <div className="two-column spacing-top">
        <section className={`card role-action-card ${activeRole === 'ADMIN' ? 'admin-action-card' : ''}`}>
          <p className="eyebrow">{roleLabel(activeRole)} · текущий контекст</p>
          <h2>{statusLabels[deal.status] ?? deal.status}</h2>
          {roleAction(deal)}

          {canReportProblem ? (
            <details className="problem-box">
              <summary>Сообщить о проблеме как {roleLabel(activeRole).toLowerCase()}</summary>
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
          <p className="eyebrow">Общее состояние</p>
          <h2>Расчёты и доставка</h2>
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

      <EvidencePanel dealId={deal.id} protectionPlan={deal.protectionPlan} activeRole={activeRole} onChanged={() => void load()} />

      <DisputePanel dealId={deal.id} dealStatus={deal.status} dealAmountKzt={deal.amountKzt} activeRole={activeRole} onChanged={() => void load()} />

      <section className="card spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Общая история</p>
            <h2>Audit trail сделки</h2>
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
