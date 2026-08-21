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

type ChecklistItem = {
  key: string;
  label: string;
  role: 'BUYER' | 'SELLER';
  kind: string;
  stage: 'PRE_SHIPMENT' | 'RECEIPT';
  required: boolean;
  satisfied: boolean;
};

type ProtectionChecklist = {
  protectionPlan: 'BASIC' | 'EXTENDED';
  category: string;
  required: boolean;
  complete: boolean;
  items: ChecklistItem[];
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

function roleLabel(role: string) {
  return role === 'SELLER' ? 'Продавец' : role === 'BUYER' ? 'Покупатель' : role;
}

function evidenceKindLabel(kind: string) {
  const labels: Record<string, string> = {
    PHOTO: 'Состояние / общий вид',
    VIDEO: 'Видео / распаковка',
    DOCUMENT: 'Документ',
    SERIAL_NUMBER: 'Серийный номер / шильдик',
    PACKAGING: 'Упаковка',
    DELIVERY: 'Доставка',
    OTHER: 'Другое'
  };
  return labels[kind] ?? kind;
}

export function EvidencePanel({
  dealId,
  protectionPlan,
  onChanged
}: {
  dealId: string;
  protectionPlan: 'BASIC' | 'EXTENDED';
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [checklist, setChecklist] = useState<ProtectionChecklist | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('PHOTO');
  const [uploaderRole, setUploaderRole] = useState('SELLER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [evidenceResponse, checklistResponse] = await Promise.all([
      fetch(`/api/backend/deals/${dealId}/evidence`, { cache: 'no-store' }),
      fetch(`/api/backend/deals/${dealId}/protection-checklist`, { cache: 'no-store' })
    ]);
    if (evidenceResponse.ok) setItems((await evidenceResponse.json()) as Evidence[]);
    if (checklistResponse.ok) setChecklist((await checklistResponse.json()) as ProtectionChecklist);
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  function prepareChecklistEvidence(item: ChecklistItem) {
    setKind(item.kind);
    setUploaderRole(item.role);
    setNote(item.label);
    setError('');

    const input = document.getElementById(`evidence-file-${dealId}`) as HTMLInputElement | null;
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.click();
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

  return (
    <section className="card spacing-top">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Доказательная база</p>
          <h2>Доказательства сделки</h2>
        </div>
        <span className="muted small">
          {protectionPlan === 'EXTENDED' ? 'Расширенная защита' : 'Базовая защита'} · SHA-256 на сервере
        </span>
      </div>

      <p className="muted">
        Фото, документы и другие материалы фиксируются в любом тарифе. Для базовой защиты чек-лист рекомендательный,
        для расширенной обязательные пункты контролируются перед отправкой и подтверждением получения.
      </p>

      {checklist ? (
        <div className="spacing-top-small">
          <div className={checklist.complete ? 'notice success' : checklist.required ? 'notice warning' : 'notice'}>
            {checklist.required
              ? checklist.complete
                ? 'Обязательный чек-лист расширенной защиты выполнен.'
                : 'Расширенная защита: незакрытые пункты будут блокировать соответствующий этап сделки.'
              : 'Базовая защита: эти материалы рекомендуются, но не блокируют сделку.'}
          </div>
          <div className="evidence-list spacing-top-small">
            {checklist.items.map((item) => (
              <div className="evidence-item" key={item.key}>
                <div className="evidence-main">
                  <strong>{item.satisfied ? '✓' : '○'} {item.label}</strong>
                  <span className="muted small">
                    {roleLabel(item.role)} · {evidenceKindLabel(item.kind)} · {item.stage === 'PRE_SHIPMENT' ? 'до отправки' : 'при получении'}
                    {item.required ? ' · обязательно' : ' · рекомендуется'}
                  </span>
                </div>
                {!item.satisfied ? (
                  <button
                    className="button secondary compact-button"
                    type="button"
                    disabled={busy}
                    onClick={() => prepareChecklistEvidence(item)}
                  >
                    Добавить для этого пункта
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form className="form evidence-form spacing-top" onSubmit={submit}>
        <div className="form-grid-3">
          <label className="field">
            <span>Файл</span>
            <input id={`evidence-file-${dealId}`} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="field">
            <span>Что подтверждает файл</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="PHOTO">Состояние / общий вид (фото)</option>
              <option value="VIDEO">Видео / распаковка</option>
              <option value="DOCUMENT">Документ</option>
              <option value="SERIAL_NUMBER">Серийный номер / шильдик</option>
              <option value="PACKAGING">Упаковка (фото или видео)</option>
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
              <span className="muted small">{evidenceKindLabel(item.kind)} · {roleLabel(item.uploaderRole)} · {formatSize(item.sizeBytes)} · {formatDate(item.createdAt)}</span>
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
