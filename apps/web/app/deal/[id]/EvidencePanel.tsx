'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type DealRole = 'BUYER' | 'SELLER' | 'ADMIN';
type PartyRole = 'BUYER' | 'SELLER';

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
  role: PartyRole;
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

type UploadPlan =
  | { mode: 'server' }
  | {
      mode: 'direct';
      key: string;
      uploadUrl: string;
      fields: Record<string, string>;
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
  if (role === 'SELLER') return 'Продавец';
  if (role === 'BUYER') return 'Покупатель';
  if (role === 'ADMIN') return 'Админ';
  return role;
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

async function readApiJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    let message = '';
    if (text.trim()) {
      try {
        const body = JSON.parse(text) as { message?: string | string[] };
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? '';
      } catch {
        message = text.slice(0, 300);
      }
    }
    throw new Error(message || `${label}: ошибка API ${response.status}`);
  }

  if (!text.trim()) {
    throw new Error(`${label}: API вернул пустой ответ (${response.status})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}: API вернул некорректный JSON`);
  }
}

export function EvidencePanel({
  dealId,
  protectionPlan,
  activeRole,
  onChanged
}: {
  dealId: string;
  protectionPlan: 'BASIC' | 'EXTENDED';
  activeRole: DealRole;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [checklist, setChecklist] = useState<ProtectionChecklist | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('PHOTO');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [evidenceResponse, checklistResponse] = await Promise.all([
        fetch(`/api/backend/deals/${dealId}/evidence`, { cache: 'no-store' }),
        fetch(`/api/backend/deals/${dealId}/protection-checklist`, { cache: 'no-store' })
      ]);

      const [evidenceData, checklistData] = await Promise.all([
        readApiJson<Evidence[]>(evidenceResponse, 'Доказательства'),
        readApiJson<ProtectionChecklist>(checklistResponse, 'Чек-лист защиты')
      ]);

      setItems(evidenceData);
      setChecklist(checklistData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить доказательства сделки');
    }
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFile(null);
    setKind('PHOTO');
    setNote('');
    setError('');
    const input = document.getElementById(`evidence-file-${dealId}`) as HTMLInputElement | null;
    if (input) input.value = '';
  }, [activeRole, dealId]);

  const visibleChecklist = useMemo(
    () => activeRole === 'ADMIN' ? checklist?.items ?? [] : checklist?.items.filter((item) => item.role === activeRole) ?? [],
    [checklist, activeRole]
  );
  const visibleEvidence = useMemo(
    () => activeRole === 'ADMIN' ? items : items.filter((item) => item.uploaderRole === activeRole),
    [items, activeRole]
  );
  const visibleChecklistComplete = activeRole === 'ADMIN'
    ? Boolean(checklist?.complete)
    : visibleChecklist.every((item) => item.satisfied);

  function prepareChecklistEvidence(item: ChecklistItem) {
    if (activeRole === 'ADMIN') return;
    setKind(item.kind);
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
    if (activeRole === 'ADMIN') return;
    if (!file) {
      setError('Выберите файл');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Для пилота максимальный размер доказательства 25 МБ');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const prepareResponse = await fetch(`/api/backend/deals/${dealId}/evidence/prepare-upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name })
      });
      const plan = await readApiJson<UploadPlan>(prepareResponse, 'Подготовка загрузки');

      if (plan.mode === 'direct') {
        const cloudinaryForm = new FormData();
        for (const [name, value] of Object.entries(plan.fields)) {
          cloudinaryForm.set(name, value);
        }
        cloudinaryForm.set('file', file);

        const uploadResponse = await fetch(plan.uploadUrl, {
          method: 'POST',
          body: cloudinaryForm
        });

        if (!uploadResponse.ok) {
          const text = await uploadResponse.text();
          let message = `Cloudinary: ошибка загрузки ${uploadResponse.status}`;
          if (text.trim()) {
            try {
              const body = JSON.parse(text) as { error?: { message?: string } };
              message = body.error?.message || message;
            } catch {
              message = text.slice(0, 300);
            }
          }
          throw new Error(message);
        }

        const finalizeResponse = await fetch(`/api/backend/deals/${dealId}/evidence/finalize-upload`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key: plan.key,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            kind,
            uploaderRole: activeRole,
            note: note.trim() || undefined
          })
        });
        await readApiJson<Evidence>(finalizeResponse, 'Регистрация доказательства');
      } else {
        const data = new FormData();
        data.set('file', file);
        data.set('kind', kind);
        data.set('uploaderRole', activeRole);
        if (note.trim()) data.set('note', note.trim());

        const response = await fetch(`/api/backend/deals/${dealId}/evidence`, {
          method: 'POST',
          body: data
        });
        await readApiJson<Evidence>(response, 'Загрузка доказательства');
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

  const isAdmin = activeRole === 'ADMIN';

  return (
    <section className="card spacing-top">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Доказательная база · {roleLabel(activeRole)}</p>
          <h2>{isAdmin ? 'Контроль доказательств обеих сторон' : 'Ваш чек-лист и материалы'}</h2>
        </div>
        <span className="muted small">
          {protectionPlan === 'EXTENDED' ? 'Расширенная защита' : 'Базовая защита'} · SHA-256 на сервере
        </span>
      </div>

      {error ? <div className="notice error spacing-top-small">{error}</div> : null}

      {checklist ? (
        <div className="spacing-top-small">
          <div className={visibleChecklistComplete ? 'notice success' : checklist.required ? 'notice warning' : 'notice'}>
            {isAdmin
              ? checklist.complete
                ? 'Общий чек-лист сделки выполнен.'
                : 'В сделке остаются незакрытые пункты доказательной фиксации.'
              : checklist.required
                ? visibleChecklistComplete
                  ? `Чек-лист стороны «${roleLabel(activeRole)}» выполнен.`
                  : `Расширенная защита: стороне «${roleLabel(activeRole)}» нужно закрыть обязательные пункты своего этапа.`
                : `Базовая защита: материалы для стороны «${roleLabel(activeRole)}» рекомендуются, но не блокируют сделку.`}
          </div>
          <div className="evidence-list spacing-top-small">
            {visibleChecklist.map((item) => (
              <div className="evidence-item" key={item.key}>
                <div className="evidence-main">
                  <strong>{item.satisfied ? '✓' : '○'} {item.label}</strong>
                  <span className="muted small">
                    {isAdmin ? `${roleLabel(item.role)} · ` : ''}{evidenceKindLabel(item.kind)} · {item.stage === 'PRE_SHIPMENT' ? 'до отправки' : 'при получении'}
                    {item.required ? ' · обязательно' : ' · рекомендуется'}
                  </span>
                </div>
                {!isAdmin && !item.satisfied ? (
                  <button className="button secondary compact-button" type="button" disabled={busy} onClick={() => prepareChecklistEvidence(item)}>
                    Добавить для этого пункта
                  </button>
                ) : null}
              </div>
            ))}
            {visibleChecklist.length === 0 ? <p className="muted">Пунктов чек-листа нет.</p> : null}
          </div>
        </div>
      ) : null}

      {!isAdmin ? (
        <form className="form evidence-form spacing-top" onSubmit={submit}>
          <div className="role-context">
            Вы загружаете материал как <strong>{roleLabel(activeRole)}</strong>. В рабочей версии роль будет определяться аккаунтом автоматически.
          </div>
          <div className="form-grid-2">
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
          </div>
          <label className="field">
            <span>Примечание</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Что подтверждает этот файл" />
          </label>
          <button className="button" disabled={busy} type="submit">{busy ? 'Загрузка…' : 'Добавить доказательство'}</button>
        </form>
      ) : (
        <div className="role-context spacing-top">
          Админ просматривает материалы обеих сторон. Добавление доказательств от имени участников из административного режима отключено.
        </div>
      )}

      <div className="evidence-list spacing-top">
        <div className="section-heading">
          <h3>{isAdmin ? 'Все материалы сделки' : `Материалы стороны «${roleLabel(activeRole)}»`}</h3>
          <span className="muted small">{visibleEvidence.length} шт.</span>
        </div>
        {visibleEvidence.map((item) => (
          <div className="evidence-item" key={item.id}>
            <div className="evidence-main">
              <strong>{item.fileName}</strong>
              <span className="muted small">
                {isAdmin ? `${roleLabel(item.uploaderRole)} · ` : ''}{evidenceKindLabel(item.kind)} · {formatSize(item.sizeBytes)} · {formatDate(item.createdAt)}
              </span>
              {item.note ? <span>{item.note}</span> : null}
              <code className="hash">SHA-256: {item.sha256}</code>
            </div>
            <a className="button secondary compact-button" href={`/api/backend/deals/${dealId}/evidence/${item.id}/file`} target="_blank" rel="noreferrer">Открыть</a>
          </div>
        ))}
        {visibleEvidence.length === 0 ? <p className="muted">Материалов пока нет.</p> : null}
      </div>
    </section>
  );
}
