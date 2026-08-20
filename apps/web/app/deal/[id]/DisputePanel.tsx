'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Evidence = {
  id: string;
  fileName: string;
};

type DisputeMessage = {
  id: string;
  actorRole: string;
  messageType: string;
  body: string;
  settlementType: string | null;
  amountKzt: number | null;
  evidenceId: string | null;
  proposalId: string | null;
  createdAt: string;
  evidence?: { id: string; fileName: string; sha256: string } | null;
};

const settlementLabels: Record<string, string> = {
  FULL_REFUND: 'Полный возврат покупателю',
  PARTIAL_REFUND: 'Частичный возврат покупателю',
  RELEASE_TO_SELLER: 'Выплата продавцу',
  CUSTOM: 'Иное соглашение'
};

function money(value: number | null) {
  if (value === null) return '';
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₸';
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function DisputePanel({
  dealId,
  dealStatus,
  dealAmountKzt,
  evidenceEnabled,
  onChanged
}: {
  dealId: string;
  dealStatus: string;
  dealAmountKzt: number;
  evidenceEnabled: boolean;
  onChanged: () => void;
}) {
  const enabled = ['PROBLEM_REPORTED', 'WAITING_LEGAL_RESOLUTION'].includes(dealStatus);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actorRole, setActorRole] = useState('BUYER');
  const [mode, setMode] = useState<'MESSAGE' | 'PROPOSAL'>('MESSAGE');
  const [body, setBody] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [settlementType, setSettlementType] = useState('FULL_REFUND');
  const [amountKzt, setAmountKzt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const respondedProposalIds = useMemo(
    () => new Set(messages.filter((item) => item.proposalId).map((item) => item.proposalId as string)),
    [messages]
  );
  const hasAcceptedAgreement = useMemo(
    () => messages.some((item) => item.messageType === 'PROPOSAL_ACCEPTED'),
    [messages]
  );

  const load = useCallback(async () => {
    if (!enabled) return;

    const messagesResponse = await fetch(`/api/backend/deals/${dealId}/dispute/messages`, { cache: 'no-store' });
    if (messagesResponse.ok) setMessages((await messagesResponse.json()) as DisputeMessage[]);

    if (evidenceEnabled) {
      const evidenceResponse = await fetch(`/api/backend/deals/${dealId}/evidence`, { cache: 'no-store' });
      if (evidenceResponse.ok) setEvidence((await evidenceResponse.json()) as Evidence[]);
    } else {
      setEvidence([]);
      setEvidenceId('');
    }
  }, [dealId, enabled, evidenceEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (hasAcceptedAgreement && mode === 'PROPOSAL') setMode('MESSAGE');
  }, [hasAcceptedAgreement, mode]);

  if (!enabled) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length < 2) {
      setError('Введите сообщение или условия предложения');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const proposal = mode === 'PROPOSAL';
      const payload: Record<string, unknown> = {
        actorRole,
        body: body.trim()
      };
      if (evidenceEnabled && evidenceId) payload.evidenceId = evidenceId;
      if (proposal) {
        payload.settlementType = settlementType;
        if (amountKzt.trim()) payload.amountKzt = Number(amountKzt);
      }

      const response = await fetch(
        `/api/backend/deals/${dealId}/dispute/${proposal ? 'proposals' : 'messages'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.message || `Ошибка API: ${response.status}`);
      }

      setBody('');
      setEvidenceId('');
      setAmountKzt('');
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setBusy(false);
    }
  }

  async function respond(proposalId: string, decision: 'ACCEPT' | 'REJECT') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/backend/deals/${dealId}/dispute/proposals/${proposalId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorRole, decision })
      });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.message || `Ошибка API: ${response.status}`);
      }
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось ответить на предложение');
    } finally {
      setBusy(false);
    }
  }

  const needsAmount = settlementType === 'PARTIAL_REFUND' || settlementType === 'CUSTOM';

  return (
    <section className="card spacing-top dispute-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Урегулирование</p>
          <h2>Канал спора между сторонами</h2>
        </div>
        <span className="muted small">Amanat Deal фиксирует переговоры, но не решает спор за стороны.</span>
      </div>

      <div className="notice warning">
        Принятие предложения фиксирует соглашение сторон. Фактический возврат или выплата выполняются отдельной backend-командой после проверки оснований.
      </div>
      {!evidenceEnabled ? (
        <div className="notice spacing-top-small">
          Канал работает без файлов. Чтобы прикладывать фото и документы к сообщениям, подключите расширение «Доказательства» выше.
        </div>
      ) : null}
      {hasAcceptedAgreement ? (
        <div className="notice success spacing-top-small">
          Стороны зафиксировали соглашение. Новые предложения заблокированы; сообщения и доказательства остаются доступны до исполнения settlement.
        </div>
      ) : null}

      <div className="dispute-messages spacing-top">
        {messages.map((item) => {
          const isProposal = item.messageType === 'PROPOSAL';
          const canRespond = isProposal && !hasAcceptedAgreement && item.actorRole !== actorRole && !respondedProposalIds.has(item.id);
          return (
            <div className={`dispute-message role-${item.actorRole.toLowerCase()}`} key={item.id}>
              <div className="dispute-message-head">
                <strong>{item.actorRole === 'BUYER' ? 'Покупатель' : item.actorRole === 'SELLER' ? 'Продавец' : item.actorRole}</strong>
                <span className="muted small">{dateTime(item.createdAt)}</span>
              </div>
              {isProposal ? (
                <div className="proposal-badge">
                  Предложение: {settlementLabels[item.settlementType || ''] || item.settlementType}
                  {item.amountKzt !== null ? ` · ${money(item.amountKzt)}` : ''}
                </div>
              ) : null}
              {item.messageType === 'PROPOSAL_ACCEPTED' ? <div className="notice success compact-notice">Предложение принято</div> : null}
              {item.messageType === 'PROPOSAL_REJECTED' ? <div className="notice error compact-notice">Предложение отклонено</div> : null}
              <p>{item.body}</p>
              {item.evidence ? (
                <a href={`/api/backend/deals/${dealId}/evidence/${item.evidence.id}/file`} target="_blank" rel="noreferrer">
                  Доказательство: {item.evidence.fileName}
                </a>
              ) : null}
              {canRespond ? (
                <div className="button-row spacing-top-small">
                  <button className="button" disabled={busy} onClick={() => void respond(item.id, 'ACCEPT')}>Принять</button>
                  <button className="button secondary" disabled={busy} onClick={() => void respond(item.id, 'REJECT')}>Отклонить</button>
                </div>
              ) : null}
            </div>
          );
        })}
        {messages.length === 0 ? <p className="muted">Переговоров пока нет.</p> : null}
      </div>

      <form className="form dispute-form spacing-top" onSubmit={submit}>
        <div className={evidenceEnabled ? 'form-grid-3' : 'form-grid-2'}>
          <label className="field">
            <span>Роль в пилоте</span>
            <select value={actorRole} onChange={(event) => setActorRole(event.target.value)}>
              <option value="BUYER">Покупатель</option>
              <option value="SELLER">Продавец</option>
            </select>
          </label>
          <label className="field">
            <span>Тип</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as 'MESSAGE' | 'PROPOSAL')}>
              <option value="MESSAGE">Сообщение</option>
              <option value="PROPOSAL" disabled={hasAcceptedAgreement}>Предложение урегулирования</option>
            </select>
          </label>
          {evidenceEnabled ? (
            <label className="field">
              <span>Приложить доказательство</span>
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>
                <option value="">Без файла</option>
                {evidence.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        {mode === 'PROPOSAL' ? (
          <div className="form-grid-2">
            <label className="field">
              <span>Вариант урегулирования</span>
              <select value={settlementType} onChange={(event) => setSettlementType(event.target.value)}>
                <option value="FULL_REFUND">Полный возврат покупателю</option>
                <option value="PARTIAL_REFUND">Частичный возврат покупателю</option>
                <option value="RELEASE_TO_SELLER">Выплата продавцу</option>
                <option value="CUSTOM">Иное соглашение</option>
              </select>
            </label>
            <label className="field">
              <span>Сумма, ₸ {needsAmount ? '' : '(определяется суммой сделки)'}</span>
              <input
                type="number"
                min="1"
                max={dealAmountKzt}
                disabled={!needsAmount}
                value={needsAmount ? amountKzt : String(dealAmountKzt)}
                onChange={(event) => setAmountKzt(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <label className="field">
          <span>{mode === 'PROPOSAL' ? 'Условия предложения' : 'Сообщение другой стороне'}</span>
          <textarea rows={4} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="button" disabled={busy} type="submit">{busy ? 'Отправка…' : mode === 'PROPOSAL' ? 'Отправить предложение' : 'Отправить сообщение'}</button>
      </form>
    </section>
  );
}
