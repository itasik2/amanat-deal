'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type DealCategory = 'GOODS' | 'SERVICE' | 'REPAIR' | 'EQUIPMENT' | 'OTHER';
type ProtectionPlan = 'BASIC' | 'EXTENDED';

type CreatedDeal = {
  id: string;
};

async function parseApiError(response: Response) {
  const body = await response.json().catch(() => null);
  if (body && typeof body.message === 'string') return body.message;
  if (body && Array.isArray(body.message)) return body.message.join(', ');
  return `Ошибка API: ${response.status}`;
}

export default function CreateDealPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DealCategory>('GOODS');
  const [protectionPlan, setProtectionPlan] = useState<ProtectionPlan>('BASIC');
  const [amountKzt, setAmountKzt] = useState('');
  const [inspectionHours, setInspectionHours] = useState('48');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/backend/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          protectionPlan,
          amountKzt: Number(amountKzt),
          inspectionHours: Number(inspectionHours)
        })
      });

      if (!response.ok) throw new Error(await parseApiError(response));

      const deal = (await response.json()) as CreatedDeal;
      router.push(`/deal/${deal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сделку');
    } finally {
      setSubmitting(false);
    }
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
          Укажите предмет сделки, сумму, уровень защиты и срок проверки. Доказательства и история событий собираются в любом тарифе.
        </p>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Название сделки</span>
            <input
              required
              minLength={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: комплект автозапчастей"
            />
          </label>

          <label className="field">
            <span>Описание и условия</span>
            <textarea
              required
              minLength={10}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Что именно передаётся или выполняется, состояние, комплектация и другие проверяемые условия"
            />
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
              ? 'Расширенная защита: усиленный сценарий фиксации состояния, упаковки, серийных данных и исполнения сделки. Доказательства всё равно принадлежат самой сделке, а не отдельной платной функции.'
              : 'Базовая защита: условия, оплата, доставка, сообщения, audit trail и доказательства входят в сделку. Дополнительное сопровождение спора оплачивается отдельно только при необходимости.'}
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
              <input
                required
                min={1000}
                step={1}
                inputMode="numeric"
                type="number"
                value={amountKzt}
                onChange={(event) => setAmountKzt(event.target.value)}
                placeholder="100000"
              />
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
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? 'Создаём…' : 'Создать сделку'}
            </button>
            <Link className="button secondary" href="/">Отмена</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
