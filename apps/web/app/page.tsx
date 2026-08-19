'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Deal = {
  id: string;
  publicCode: string;
  title: string;
  amountKzt: number;
  platformFeeKzt: number;
  status: string;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  WAITING_BUYER: 'Ожидает покупателя',
  WAITING_PAYMENT: 'Ожидает оплаты',
  FUNDS_SECURED: 'Средства зарезервированы',
  WAITING_SHIPMENT: 'Ожидает отправки',
  SHIPPED: 'Отправлено',
  DELIVERED: 'Доставлено',
  INSPECTION: 'Проверка',
  COMPLETED: 'Завершено',
  PROBLEM_REPORTED: 'Есть проблема',
  CANCELLED: 'Отменено',
  EXPIRED: 'Истекло'
};

function money(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₸';
}

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDeals = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/backend/deals', { cache: 'no-store' });
      if (!response.ok) throw new Error(`API вернул ${response.status}`);
      setDeals((await response.json()) as Deal[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сделки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  return (
    <main className="page">
      <section className="card hero-card">
        <div className="hero-layout">
          <div>
            <p className="eyebrow">Amanat Deal · пилот</p>
            <h1>Безопасная сделка с понятными правилами</h1>
            <p className="lead">
              Условия фиксируются заранее, mock-escrow подтверждает резервирование средств, доставка и действия сторон попадают в историю сделки.
            </p>
            <div className="actions">
              <Link className="button" href="/deal/create">Создать сделку</Link>
              <button className="button secondary" onClick={() => void loadDeals()}>Обновить список</button>
            </div>
          </div>
          <div className="pilot-note">
            <strong>Сейчас это пилот</strong>
            <span>Реальные деньги не принимаются. Платёжный этап имитируется mock-escrow.</span>
          </div>
        </div>
      </section>

      <section className="grid spacing-top">
        <div className="card"><h3>Деньги</h3><p className="muted">Пока mock-escrow. Банковский provider подключим после проверки продуктовой логики.</p></div>
        <div className="card"><h3>Условия</h3><p className="muted">У сделки есть предмет, сумма, срок проверки и неизменяемая история событий.</p></div>
        <div className="card"><h3>Спор</h3><p className="muted">Платформа фиксирует проблему, но не изображает из себя суд в браузере.</p></div>
      </section>

      <section className="spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PostgreSQL</p>
            <h2>Тестовые сделки</h2>
          </div>
          <span className="muted small">{deals.length} шт.</span>
        </div>

        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="card">Загружаем сделки…</div> : null}

        {!loading && deals.length === 0 ? (
          <div className="card empty-state">
            <h3>Сделок пока нет</h3>
            <p className="muted">Создайте первую тестовую сделку и пройдите весь сценарий в браузере.</p>
            <Link className="button" href="/deal/create">Создать первую</Link>
          </div>
        ) : null}

        <div className="deal-list">
          {deals.map((deal) => (
            <Link className="deal-row" href={`/deal/${deal.id}`} key={deal.id}>
              <div>
                <strong>{deal.title}</strong>
                <p className="muted small">{deal.publicCode}</p>
              </div>
              <div className="deal-row-right">
                <strong>{money(deal.amountKzt)}</strong>
                <span className={`status status-${deal.status.toLowerCase()}`}>{statusLabels[deal.status] ?? deal.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
