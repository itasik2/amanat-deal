'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ApiResponse = {
  user?: {
    id: string;
    phone: string | null;
    name: string | null;
  };
  phone?: string;
  debugCode?: string;
  message?: string | string[];
};

async function readResponse(response: Response) {
  const text = await response.text();
  let body: ApiResponse = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ApiResponse;
    } catch {
      body = { message: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || `Ошибка ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/backend/auth/phone/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const body = await readResponse(response);
      setMaskedPhone(body.phone || phone);
      setDebugCode(body.debugCode || '');
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/backend/auth/phone/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code, ...(name.trim() ? { name: name.trim() } : {}) })
      });
      await readResponse(response);
      const next = typeof window === 'undefined'
        ? '/'
        : new URLSearchParams(window.location.search).get('next') || '/';
      router.replace(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить номер');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="card" style={{ maxWidth: 620, margin: '48px auto 0' }}>
        <p className="eyebrow">Amanat Deal · вход</p>
        <h1>{step === 'phone' ? 'Войти по номеру телефона' : 'Подтвердить номер'}</h1>
        <p className="lead">
          Один номер — один аккаунт. Роль покупателя или продавца определяется отдельно в каждой сделке.
        </p>

        {error ? <div className="notice error spacing-top-small">{error}</div> : null}

        {step === 'phone' ? (
          <form className="form spacing-top" onSubmit={requestCode}>
            <label className="field">
              <span>Номер телефона</span>
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 747 123 45 67"
              />
            </label>
            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Получить SMS-код'}
            </button>
          </form>
        ) : (
          <form className="form spacing-top" onSubmit={verifyCode}>
            <div className="notice">Код отправлен на {maskedPhone}.</div>
            {debugCode ? (
              <div className="notice warning">Пилотный режим: код {debugCode}</div>
            ) : null}
            <label className="field">
              <span>Код из SMS</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
            </label>
            <label className="field">
              <span>Имя <span className="muted">(необязательно)</span></span>
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Как к вам обращаться"
              />
            </label>
            <div className="actions">
              <button className="button" type="submit" disabled={busy || code.length !== 6}>
                {busy ? 'Проверяем…' : 'Войти'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => { setStep('phone'); setCode(''); setDebugCode(''); setError(''); }}
              >
                Изменить номер
              </button>
            </div>
          </form>
        )}

        <div className="spacing-top-small">
          <Link className="text-button" href="/">← На главную</Link>
        </div>
      </section>
    </main>
  );
}
