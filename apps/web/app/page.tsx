'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AccountActions } from './AccountActions';

type PartyRole = 'BUYER' | 'SELLER';

type Deal = {
  id: string;
  publicCode: string;
  title: string;
  amountKzt: number;
  protectionPlan: 'BASIC' | 'EXTENDED';
  status: string;
};

type CurrentUser = {
  id: string;
  phone: string | null;
  name: string | null;
};

type MeResponse = {
  user?: CurrentUser;
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
  const [user, setUser] = useState<CurrentUser | null>(null);
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
        setUser(null);
        setDeals([]);
        return;
      }

      const meBody = await me.json() as MeResponse;
      setAuthenticated(true);
      setUser(meBody.user ?? null);

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

  function startDeal(role: PartyRole) {
    const next = `/deal/create?role=${role}`;
    window.location.href = authenticated
      ? next
      : `/login?next=${encodeURIComponent(next)}`;
  }

  return (
    <main className="home-page">
      <section className="entry-home" aria-labelledby="entry-home-title">
        <div className="entry-home-card">
          <div className="entry-home-top">
            <div className="entry-home-brand">Amanat Deal</div>
            <AccountActions />
          </div>

          <p className="entry-home-kicker">
            {authenticated ? 'Создать новую сделку' : 'Начните с вашей роли'}
          </p>
          <h1 id="entry-home-title">Что вы хотите сделать?</h1>
          <p className="entry-home-copy">
            Зафиксируйте условия сделки, пригласите вторую сторону и ведите историю договорённостей в одном месте.
            Роль выбирается заново для каждой сделки.
          </p>

          <div className="entry-role-actions" aria-label="Выбор роли в новой сделке">
            <button className="entry-role-button" type="button" onClick={() => startDeal('BUYER')}>
              <span className="entry-role-title">Я покупаю</span>
              <span className="entry-role-copy">Создам условия покупки и приглашу продавца</span>
            </button>
            <button className="entry-role-button" type="button" onClick={() => startDeal('SELLER')}>
              <span className="entry-role-title">Я продаю</span>
              <span className="entry-role-copy">Создам условия продажи и приглашу покупателя</span>
            </button>
          </div>

          <div className="entry-home-secondary-actions">
            <a className="entry-home-link" href="#how-it-works">Как это работает</a>
            <Link className="entry-home-link" href="/join">У меня есть код приглашения</Link>
          </div>

          {!loading && authenticated === false ? (
            <p className="entry-home-hint">Следующий шаг: номер телефона → SMS-код → создание сделки.</p>
          ) : null}
          {!loading && authenticated && user ? (
            <p className="entry-home-hint">Вы вошли{user.name ? ` как ${user.name}` : ''}. Повторно подтверждать телефон не нужно.</p>
          ) : null}
        </div>
      </section>

      <div className="page home-content">
        <section id="how-it-works" className="home-section">
          <div className="home-section-heading">
            <p className="eyebrow">Как это работает</p>
            <h2>От выбора роли до завершения сделки</h2>
            <p className="lead">Один аккаунт может покупать в одной сделке и продавать в другой. Никаких пожизненных ярлыков, человечество переживёт.</p>
          </div>

          <div className="home-steps">
            <article className="home-step-card">
              <span className="home-step-number">1</span>
              <h3>Выберите роль</h3>
              <p>Нажмите «Я покупаю» или «Я продаю». Роль относится только к новой сделке.</p>
            </article>
            <article className="home-step-card">
              <span className="home-step-number">2</span>
              <h3>Подтвердите телефон</h3>
              <p>Введите номер и SMS-код. Если аккаунт уже подтверждён и сессия активна, этот шаг пропускается.</p>
            </article>
            <article className="home-step-card">
              <span className="home-step-number">3</span>
              <h3>Создайте и отправьте приглашение</h3>
              <p>Укажите условия и номер второй стороны. Ссылку можно отправить через WhatsApp, Telegram или обычное «Поделиться».</p>
            </article>
            <article className="home-step-card">
              <span className="home-step-number">4</span>
              <h3>Ведите сделку в Amanat</h3>
              <p>После принятия обе стороны видят сделку в своих аккаунтах, а события и доказательства сохраняются в её истории.</p>
            </article>
          </div>
        </section>

        <section className="home-trust-grid">
          <div className="home-trust-card">
            <strong>Приглашение по номеру</strong>
            <span>Принять приглашение может только аккаунт с указанным подтверждённым номером.</span>
          </div>
          <div className="home-trust-card">
            <strong>Роли внутри сделки</strong>
            <span>Покупатель и продавец фиксируются в конкретной сделке, а аккаунт остаётся универсальным.</span>
          </div>
          <div className="home-trust-card">
            <strong>История и доказательства</strong>
            <span>Условия, события, сообщения и загруженные материалы остаются связаны со сделкой.</span>
          </div>
        </section>

        {authenticated ? (
          <section className="home-section home-deals-section">
            <div className="section-heading">
              <h2>Мои сделки</h2>
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
                <p className="muted">Выберите роль выше и создайте первую сделку.</p>
                <a className="button secondary" href="#entry-home-title">К выбору роли</a>
              </div>
            ) : null}

            {!loading && deals.length > 0 ? (
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
        ) : null}
      </div>
    </main>
  );
}
