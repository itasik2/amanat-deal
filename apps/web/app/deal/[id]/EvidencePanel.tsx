'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Evidence = {
  id: string;
  uploaderRole: string;
  kind: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  note: string | null;
  createdAt: string;
};

function formatSize(value: number) {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function EvidencePanel({
  dealId,
  enabled,
  onChanged,
  onEnabled
}: {
  dealId: string;
  enabled: boolean;
  onChanged: () => void;
  onEnabled: () => void;
}) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('PHOTO');
  const [uploaderRole, setUploaderRole] = useState('SELLER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    const response = await fetch(`/api/backend/deals/${dealId}/evidence`, { cache: 'no-store' });
    if (response.ok) setItems((await response.json()) as Evidence[]);
  }, [dealId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enableExtension() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/backend/deals/${dealId}/extensions/EVIDENCE/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorRole: 'SELLER' })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Ошибка подключения: ${response.status}`);
      }
      onEnabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подключить расширение');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Выберите файл');
      return;
    }

    setBusy(true);
    setError('');
    const data = new FormData();
    data.set('file', file);
    data.set('kind', kind);
    data.set('uploaderRole', uploaderRole);
    if (note.trim()) data.set('note', note.trim());

    try {
      const response = await fetch(`/api/backend/deals/${dealId}/evidence`, {
        method: 'POST',
        body: data
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Ошибка загрузки: ${response.status}`);
      }
      setFile(null);
      setNote('');
      const input = document.getElementById(`evidence-file-${dealId}`) as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить доказательство');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="card spacing-top">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Расширение</p>
            <h2>Доказательства сделки</h2>
          </div>
          <span className="status">Не подключено</span>
        </div>
        <p className="muted">
          Базовая сделка работает без файлов. Подключите расширение, если нужно фиксировать фото, документы,
          упаковку, серийные номера и другие материалы с серверным SHA-256.
        </p>
        {error ? <div className="notice error spacing-bottom">{error}</div> : null}
        <button className="button" disabled={busy} onClick={() => void enableExtension()}>
          {busy ? 'Подключение…' : 'Подключить доказательства'}
        </button>
      </section>
    );
  }

  return (
    <section className="card spacing-top">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Расширение · Evidence</p>
          <h2>Доказательства сделки</h2>
        </div>
        <span className="muted small">Подключено · SHA-256 считается на сервере</span>
      </div>

      <form className="form evidence-form" onSubmit={submit}>
        <div className="form-grid-3">
          <label className="field">
            <span>Файл</span>
            <input id={`evidence-file-${dealId}`} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="field">
            <span>Тип</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="PHOTO">Фото</option>
              <option value="VIDEO">Видео</option>
              <option value="DOCUMENT">Документ</option>
              <option value="SERIAL_NUMBER">Серийный номер / шильдик</option>
              <option value="PACKAGING">Упаковка</option>
              <option value="DELIVERY">Доставка</option>
              <option value="OTHER">Другое</option>
            </select>
          </label>
          <label className="field">
            <span>Сторона</span>
            <select value={uploaderRole} onChange={(event) => setUploaderRole(event.target.value)}>
              <option value="SELLER">Продавец</option>
              <option value="BUYER">Покупатель</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Примечание</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Что подтверждает этот файл" />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="button" disabled={busy} type="submit">{busy ? 'Загрузка…' : 'Добавить доказательство'}</button>
      </form>

      <div className="evidence-list spacing-top">
        {items.map((item) => (
          <div className="evidence-item" key={item.id}>
            <div className="evidence-main">
              <strong>{item.fileName}</strong>
              <span className="muted small">{item.kind} · {item.uploaderRole} · {formatSize(item.sizeBytes)} · {formatDate(item.createdAt)}</span>
              {item.note ? <span>{item.note}</span> : null}
              <code className="hash">SHA-256: {item.sha256}</code>
            </div>
            <a className="button secondary compact-button" href={`/api/backend/deals/${dealId}/evidence/${item.id}/file`} target="_blank" rel="noreferrer">Открыть</a>
          </div>
        ))}
        {items.length === 0 ? <p className="muted">Доказательств пока нет.</p> : null}
      </div>
    </section>
  );
}
