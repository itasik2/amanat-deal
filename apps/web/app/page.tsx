'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AccountActions } from './AccountActions';

type Deal = {
  id: string;
  publicCode: string;
  title: string;
  amountKzt: number;
  platformFeeKzt: number;
  protectionPlan: 'BASIC' | 'EXTENDED';
  status: string;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  WAITING_COUNTERPARTY: 'Ожидает вторую сторону',
  WAITING_PAYMENT: 'Ожидает оплаты',
  FUNDS_SECURED: 'Средства зарезервированы',
  WAITING_SHIPMENT: 'Ожидает отправки',
  SHIPPED: 'Отправлено',
  DELIVERED: 'Доставлено',
  INSPECTION: 'Проверка',
  COMPLETED: 'Завершено',
  PROBLEM_REPORTED: 'Есть проблема',
  WAITING_LEGAL_RESOLUTION: 'Урегулирование',
  CANCELLED: 'Отменено',
  EXPIRED: 'Истекло'
};

const protectionLabels: Record<string, string> = {
  BASIC: 'Базовая защита',
  EXTENDED: 'Расширенная защита'
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
        <div className="section-heading">
          <p className="eyebrow">Amanat Deal · пилот</p>
          <AccountActions />
        </div>
        <div className="hero-layout">
          <div>
            <h1>Безопасная сделка с понятными правилами</h1>
            <p className="lead">
              Создайте защищённую сделку или присоединитесь к уже созданной по ссылке либо короткому коду. Роль второй стороны определяется автоматически.
            </p>
            <div className="actions">
              <Link className="button" href="/deal/create">Создать сделку</Link>
              <Link className="button secondary" href="/join">Присоединиться</Link>
            </div>
          </div>
          <div className="pilot-note">
            <strong>Сейчас это пилот</strong>
            <span>Реальные деньги не принимаются. Платёжный этап имитируется mock-escrow, а роли пока можно дополнительно проверить через тестовые вкладки.</span>
          </div>
        </div>
      </section>

      <section className="grid spacing-top">
        <div className="card"><h3>1. Создание</h3><p className="muted">Создатель выбирает свою роль, фиксирует условия и получает приглашение для второй стороны.</p></div>
        <div className="card"><h3>2. Присоединение</h3><p className="muted">Вторая сторона открывает защищённую ссылку или вводит короткий код и проверяет условия до вступления.</p></div>
        <div className="card"><h3>3. Защита</h3><p className="muted">После принятия условий запускаются оплата, доказательства, доставка, проверка и при необходимости урегулирование.</p></div>
      </section>

      <section className="spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dev / test</p>
            <h2>Тестовые сделки</h2>
          </div>
          <div className="actions">
            <span className="muted small">{deals.length} шт.</span>
            <button className="text-button" onClick={() => void loadDeals()}>Обновить</button>
          </div>
        </div>

        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="card">Загружаем сделки…</div> : null}

        {!loading && deals.length === 0 ? (
          <div className="card empty-state">
            <h3>Сделок пока нет</h3>
            <p className="muted">Создайте первую тестовую сделку и пригласите вторую сторону.</p>
            <Link className="button" href="/deal/create">Создать первую</Link>
          </div>
        ) : null}

        <div className="deal-list">
          {deals.map((deal) => (
            <Link className="deal-row" href={`/deal/${deal.id}`} key={deal.id}>
              <div>
                <strong>{deal.title}</strong>
                <p className="muted small">{deal.publicCode} · {protectionLabels[deal.protectionPlan] ?? deal.protectionPlan}</p>
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
