'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type DealCategory = 'GOODS' | 'SERVICE' | 'REPAIR' | 'EQUIPMENT' | 'OTHER';
type ProtectionPlan = 'BASIC' | 'EXTENDED';
type PartyRole = 'SELLER' | 'BUYER';

type Invitation = {
  invitedRole: PartyRole;
  recipientPhoneMasked: string;
  shortCode: string;
  token: string;
  expiresAt: string;
};

type CreatedDeal = {
  id: string;
  publicCode: string;
  title: string;
  creatorRole: PartyRole;
  invitation: Invitation | null;
};

async function parseApiError(response: Response) {
  const body = await response.json().catch(() => null);
  if (body && typeof body.message === 'string') return body.message;
  if (body && Array.isArray(body.message)) return body.message.join(', ');
  return `Ошибка API: ${response.status}`;
}

function roleLabel(role: PartyRole) {
  return role === 'SELLER' ? 'продавца' : 'покупателя';
}

export default function CreateDealPage() {
  const [creatorRole, setCreatorRole] = useState<PartyRole>('SELLER');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DealCategory>('GOODS');
  const [protectionPlan, setProtectionPlan] = useState<ProtectionPlan>('BASIC');
  const [amountKzt, setAmountKzt] = useState('');
  const [inspectionHours, setInspectionHours] = useState('48');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedDeal | null>(null);
  const [copied, setCopied] = useState('');
  const [replacementPhone, setReplacementPhone] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (requestedRole === 'BUYER' || requestedRole === 'SELLER') {
      setCreatorRole(requestedRole);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/backend/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorRole,
          counterpartyPhone: counterpartyPhone.trim(),
          title: title.trim(),
          description: description.trim(),
          category,
          protectionPlan,
          amountKzt: Number(amountKzt),
          inspectionHours: Number(inspectionHours)
        })
      });

      if (response.status === 401 || response.status === 403) {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
        return;
      }
      if (!response.ok) throw new Error(await parseApiError(response));
      setCreated((await response.json()) as CreatedDeal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сделку');
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  }

  async function reissueInvitation() {
    if (!created || !replacementPhone.trim()) return;
    setInviteBusy(true);
    setInviteMessage('');
    try {
      const response = await fetch(`/api/backend/deals/${created.id}/invitations/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterpartyPhone: replacementPhone.trim() })
      });
      if (!response.ok) throw new Error(await parseApiError(response));
      const invitation = await response.json() as Invitation;
      setCreated({ ...created, invitation });
      setReplacementPhone('');
      setInviteMessage('Старое приглашение отозвано. Создана новая ссылка для исправленного номера.');
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : 'Не удалось изменить номер');
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvitation() {
    if (!created) return;
    setInviteBusy(true);
    setInviteMessage('');
    try {
      const response = await fetch(`/api/backend/deals/${created.id}/invitations/revoke`, { method: 'POST' });
      if (!response.ok) throw new Error(await parseApiError(response));
      setCreated({ ...created, invitation: null });
      setInviteMessage('Приглашение отозвано. Вторая сторона больше не сможет использовать старую ссылку.');
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : 'Не удалось отозвать приглашение');
    } finally {
      setInviteBusy(false);
    }
  }

  if (created) {
    const inviteUrl = created.invitation
      ? (typeof window === 'undefined'
        ? `/invite/${created.invitation.token}`
        : `${window.location.origin}/invite/${created.invitation.token}`)
      : '';

    return (
      <main className="page narrow">
        <div className="page-header">
          <Link className="back-link" href="/">← На главную</Link>
          <span className="pill">Сделка создана</span>
        </div>

        <section className="card hero-card">
          <p className="eyebrow">{created.publicCode}</p>
          <h1>{created.invitation ? `Пригласите ${roleLabel(created.invitation.invitedRole)}` : 'Приглашение отозвано'}</h1>
          <p className="lead">
            Вы создали сделку как {created.creatorRole === 'SELLER' ? 'продавец' : 'покупатель'}. Контрагент сможет войти только с номером, указанным в приглашении.
          </p>

          {created.invitation ? (
            <>
              <div className="notice success spacing-top-small">
                Приглашение привязано к {created.invitation.recipientPhoneMasked}. Даже если ссылка попадёт другому человеку, принять сделку с другим номером нельзя.
              </div>

              <div className="invite-share spacing-top">
                <div className="invite-value">
                  <span className="muted small">Ссылка-приглашение</span>
                  <code>{inviteUrl}</code>
                  <button className="button secondary compact-button" type="button" onClick={() => void copy(inviteUrl, 'link')}>
                    {copied === 'link' ? 'Скопировано' : 'Скопировать ссылку'}
                  </button>
                </div>

                <div className="invite-value">
                  <span className="muted small">Короткий код</span>
                  <strong className="invite-code">{created.invitation.shortCode}</strong>
                  <button className="button secondary compact-button" type="button" onClick={() => void copy(created.invitation!.shortCode, 'code')}>
                    {copied === 'code' ? 'Скопировано' : 'Скопировать код'}
                  </button>
                </div>
              </div>

              <p className="muted small spacing-top-small">
                Приглашение действует до {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(created.invitation.expiresAt))}.
              </p>
            </>
          ) : (
            <div className="notice warning spacing-top-small">Сейчас активного приглашения нет. Укажите правильный номер ниже, чтобы создать новое.</div>
          )}

          <div className="card inset-card spacing-top">
            <h3>Ошиблись номером?</h3>
            <p className="muted">До присоединения второй стороны можно заменить номер. Старый токен и код будут немедленно отозваны.</p>
            <label className="field spacing-top-small">
              <span>Правильный номер контрагента</span>
              <input
                type="tel"
                value={replacementPhone}
                onChange={(event) => setReplacementPhone(event.target.value)}
                placeholder="+7 747 123 45 67"
              />
            </label>
            <div className="actions spacing-top-small">
              <button className="button secondary" type="button" disabled={inviteBusy || !replacementPhone.trim()} onClick={() => void reissueInvitation()}>
                {inviteBusy ? 'Обновляем…' : 'Изменить номер и создать новую ссылку'}
              </button>
              {created.invitation ? (
                <button className="text-button" type="button" disabled={inviteBusy} onClick={() => void revokeInvitation()}>
                  Отозвать приглашение
                </button>
              ) : null}
            </div>
            {inviteMessage ? <div className="notice spacing-top-small">{inviteMessage}</div> : null}
          </div>

          <div className="actions spacing-top">
            <Link className="button" href={`/deal/${created.id}`}>Открыть сделку</Link>
            <Link className="button secondary" href="/">К моим сделкам</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <div className="page-header">
        <Link className="back-link" href="/">← На главную</Link>
        <span className="pill">Пилот · mock-escrow</span>
      </div>

      <section className="card">
        <p className="eyebrow">Новая сделка</p>
        <h1>Зафиксировать условия</h1>
        <p className="muted">
          Выберите свою роль, укажите контрагента и условия. Аккаунт остаётся нейтральным: в другой сделке ваша роль может быть другой.
        </p>

        <div className="role-tabs creator-role-tabs spacing-top-small" role="tablist" aria-label="Роль создателя сделки">
          <button className={`role-tab ${creatorRole === 'SELLER' ? 'active' : ''}`} type="button" role="tab" aria-selected={creatorRole === 'SELLER'} onClick={() => setCreatorRole('SELLER')}>
            <span>Я продавец</span>
            <small>Создаю условия и приглашаю покупателя</small>
          </button>
          <button className={`role-tab ${creatorRole === 'BUYER' ? 'active' : ''}`} type="button" role="tab" aria-selected={creatorRole === 'BUYER'} onClick={() => setCreatorRole('BUYER')}>
            <span>Я покупатель</span>
            <small>Создаю запрос и приглашаю продавца</small>
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Телефон второй стороны</span>
            <input
              type="tel"
              required
              minLength={10}
              value={counterpartyPhone}
              onChange={(event) => setCounterpartyPhone(event.target.value)}
              placeholder="+7 747 123 45 67"
            />
            <small className="muted">Только владелец этого номера после SMS-подтверждения сможет принять приглашение.</small>
          </label>

          <label className="field">
            <span>Название сделки</span>
            <input required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: комплект автозапчастей" />
          </label>

          <label className="field">
            <span>Описание и условия</span>
            <textarea required minLength={10} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что именно передаётся или выполняется, состояние, комплектация и другие проверяемые условия" />
          </label>

          <label className="field">
            <span>Уровень защиты</span>
            <select value={protectionPlan} onChange={(event) => setProtectionPlan(event.target.value as ProtectionPlan)}>
              <option value="BASIC">Базовая защита · стандартная комиссия</option>
              <option value="EXTENDED">Расширенная защита · усиленная фиксация и повышенный тариф</option>
            </select>
          </label>

          <div className={protectionPlan === 'EXTENDED' ? 'notice warning' : 'notice'}>
            {protectionPlan === 'EXTENDED'
              ? 'Расширенная защита: усиленный сценарий фиксации состояния, упаковки, серийных данных и исполнения сделки.'
              : 'Базовая защита: условия, оплата, доставка, сообщения, audit trail и доказательства входят в сделку.'}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Категория</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as DealCategory)}>
                <option value="GOODS">Товар</option>
                <option value="SERVICE">Услуга</option>
                <option value="REPAIR">Ремонт</option>
                <option value="EQUIPMENT">Оборудование</option>
                <option value="OTHER">Другое</option>
              </select>
            </label>

            <label className="field">
              <span>Сумма, ₸</span>
              <input required min={1000} step={1} inputMode="numeric" type="number" value={amountKzt} onChange={(event) => setAmountKzt(event.target.value)} placeholder="100000" />
            </label>

            <label className="field">
              <span>Срок проверки</span>
              <select value={inspectionHours} onChange={(event) => setInspectionHours(event.target.value)}>
                <option value="24">24 часа</option>
                <option value="48">48 часов</option>
                <option value="72">3 дня</option>
              </select>
            </label>
          </div>

          {error ? <div className="notice error">{error}</div> : null}

          <div className="actions">
            <button className="button" type="submit" disabled={submitting}>{submitting ? 'Создаём…' : 'Создать сделку'}</button>
            <Link className="button secondary" href="/">Отмена</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
