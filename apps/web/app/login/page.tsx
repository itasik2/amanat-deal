'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthResponse = {
  user?: {
    id: string;
    email: string | null;
    name: string | null;
  };
  message?: string | string[];
};

async function readResponse(response: Response) {
  const text = await response.text();
  let body: AuthResponse = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text) as AuthResponse;
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
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`/api/backend/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(mode === 'register' && name.trim() ? { name: name.trim() } : {})
        })
      });

      await readResponse(response);
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="card" style={{ maxWidth: 620, margin: '48px auto 0' }}>
        <p className="eyebrow">Amanat Deal · аккаунт</p>
        <h1>{mode === 'login' ? 'Вход' : 'Создание аккаунта'}</h1>
        <p className="lead">
          Аккаунт нужен, чтобы роль продавца или покупателя принадлежала конкретному участнику, а не переключателю в интерфейсе.
        </p>

        <div className="actions spacing-top-small">
          <button
            type="button"
            className={mode === 'login' ? 'button' : 'button secondary'}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Войти
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'button' : 'button secondary'}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Регистрация
          </button>
        </div>

        {error ? <div className="notice error spacing-top-small">{error}</div> : null}

        <form className="form spacing-top" onSubmit={submit}>
          {mode === 'register' ? (
            <label className="field">
              <span>Имя</span>
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Как к вам обращаться"
              />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Не менее 8 символов"
            />
          </label>

          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="spacing-top-small">
          <Link className="text-button" href="/">← На главную</Link>
        </div>
      </section>
    </main>
  );
}
