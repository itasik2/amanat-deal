'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type User = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

export function AccountActions() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/backend/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { user?: User };
        return body.user ?? null;
      })
      .then((nextUser) => {
        if (!cancelled) setUser(nextUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch('/api/backend/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  }

  if (loading) return <span className="muted small">Аккаунт…</span>;

  if (!user) {
    return <Link className="button secondary" href="/login">Войти</Link>;
  }

  return (
    <div className="actions">
      <span className="muted small">{user.name || user.email || 'Участник'}</span>
      <button className="text-button" type="button" onClick={() => void logout()}>Выйти</button>
    </div>
  );
}
