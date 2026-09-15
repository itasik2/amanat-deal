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
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDeals = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const me = await fetch('/api/backend/auth/me', { cache: 'no-store' });
      if (!me.ok) {
        setAuthenticated(false);
        setDeals([]);
        return;
      }

      setAuthenticated(true);
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
            <h1>Безопасная сделка между двумя людьми</h1>
            <p className="lead">
              Выберите свою роль в новой сделке. Аккаунт не делится на покупателей и продавцов: в каждой сделке роль определяется заново.
            </p>
            <div className="actions">
              <Link className="button" href="/deal/create?role=BUYER">Я покупаю</Link>
              <Link className="button" href="/deal/create?role=SELLER">Я продаю</Link>
              <Link className="button secondary" href="/join">У меня есть код</Link>
            </div>
          </div>
          <div className="pilot-note">
            <strong>Сейчас это пилот</strong>
            <span>Вход уже строится вокруг телефона и SMS-кода. Реальные деньги пока не принимаются: платёжный этап остаётся mock-escrow.</span>
          </div>
        </div>
      </section>

      <section className="grid spacing-top">
        <div className="card"><h3>1. Телефон</h3><p className="muted">Номер подтверждает аккаунт. Один и тот же пользователь может быть покупателем в одной сделке и продавцом в другой.</p></div>
        <div className="card"><h3>2. Приглашение</h3><p className="muted">Ссылка привязана к номеру контрагента. Ошибочный номер можно заменить до принятия, старое приглашение станет недействительным.</p></div>
        <div className="card"><h3>3. Сделка</h3><p className="muted">После присоединения обе стороны фиксируются, а сделка появляется в аккаунтах обоих участников.</p></div>
      </section>

      <section className="spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Аккаунт</p>
            <h2>Мои сделки</h2>
          </div>
          {authenticated ? (
            <div className="actions">
              <span className="muted small">{deals.length} шт.</span>
              <button className="text-button" onClick={() => void loadDeals()}>Обновить</button>
            </div>
          ) : null}
        </div>

        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="card">Проверяем аккаунт…</div> : null}

        {!loading && authenticated === false ? (
          <div className="card empty-state">
            <h3>Войдите по номеру телефона</h3>
            <p className="muted">После входа здесь будут только сделки, в которых вы покупатель или продавец.</p>
            <Link className="button" href="/login">Войти</Link>
          </div>
        ) : null}

        {!loading && authenticated && deals.length === 0 ? (
          <div className="card empty-state">
            <h3>Сделок пока нет</h3>
            <p className="muted">Создайте первую сделку как покупатель или продавец.</p>
            <div className="actions">
              <Link className="button" href="/deal/create?role=BUYER">Купить</Link>
              <Link className="button secondary" href="/deal/create?role=SELLER">Продать</Link>
            </div>
          </div>
        ) : null}

        {authenticated ? (
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
        ) : null}
      </section>
    </main>
  );
}
