import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from '../auth/auth.service';

// Immutable, generic copy: replaying a journal entry cannot leak changed deal terms.
export const eventTexts: Record<string, string> = {
  'deal.created': 'Сделка создана.',
  'deal.counterparty_joined': 'Второй участник присоединился к сделке.',
  'deal.accepted': 'Участник подтвердил условия сделки.',
  'mock_escrow.funds_secured': 'В mock-режиме отмечено резервирование средств. Реальные деньги не списывались.',
  'shipment.added': 'Исполнитель отметил отправку или передачу результата.',
  'inspection.started': 'Начался срок проверки результата сделки.',
  'inspection.expired': 'Срок проверки сделки истёк. Проверьте её статус в Amanat.',
  'mock_escrow.release_to_seller': 'Mock-сделка завершена. Реальной выплаты не было.',
  'problem.reported': 'Участник сообщил о проблеме по сделке.',
};
type Cursor = { at: string; id: string; since: string };
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private running?: Promise<{ processed: number }>;
  constructor(private readonly db: PrismaService) {}
  async authReadiness() {
    const tables = await this.db.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
    const names = new Set(tables.map(row => row.tablename));
    const required = ['User', 'UserSession', 'DealInvitation', 'PhoneOtpChallenge'];
    const columns = await this.db.$queryRaw<Array<{ table_name: string; column_name: string }>>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('User','UserSession','DealInvitation','PhoneOtpChallenge')`;
    const migrations = names.has('_prisma_migrations')
      ? await this.db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`
      : [];
    let otpQuery = 'ready';
    try { await this.db.phoneOtpChallenge.findFirst({ select: { id: true } }); }
    catch (error) { otpQuery = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'failed'; }
    return { missingTables: required.filter(name => !names.has(name)), columns, migrations, otpQuery,
      migrationHistory: names.has('_prisma_migrations'), production: process.env.NODE_ENV === 'production',
      otpSecretConfigured: Boolean(process.env.OTP_HASH_SECRET?.trim()), notifyConfigured: this.configured() };
  }
  configured() { return Boolean(process.env.NOTIFY_KZ_INTEGRATION_KEY); }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    if (!this.configured()) throw new ServiceUnavailableException('Уведомления ещё не подключены администратором');
    const base = new URL(process.env.NOTIFY_KZ_API_URL || 'https://notify-kz-api.vercel.app');
    if (base.protocol !== 'https:') throw new ServiceUnavailableException('Notify API requires HTTPS');
    const response = await fetch(base.origin + '/v1/integration-api' + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { authorization: 'Bearer ' + process.env.NOTIFY_KZ_INTEGRATION_KEY, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Notify KZ временно недоступен (' + response.status + ')');
    return response.json() as Promise<T>;
  }
  async status(user: PublicUser) {
    if (!this.configured()) return { available: false, channels: [], connected: false };
    return { available: true, ...await this.request<{ channels: string[]; connected: boolean }>('/subscribers/' + encodeURIComponent(user.id)) };
  }
  async connect(user: PublicUser) {
    return this.request<{ url: string }>('/sessions', { externalId: user.id, ...(user.phone ? { verifiedPhone: user.phone } : {}) });
  }
  async dispatch() {
    if (!this.configured()) return { processed: 0 };
    if (this.running) return this.running;
    this.running = this.batch().finally(() => { this.running = undefined; });
    return this.running;
  }
  async safelyDispatch() {
    try { return await this.dispatch(); }
    catch { this.logger.warn('Notify dispatch deferred; journal retained for retry'); return { processed: 0, deferred: true }; }
  }
  private async batch() {
    const cursor = await this.request<Cursor>('/cursor');
    const at = new Date(cursor.at);
    const rows = await this.db.dealEvent.findMany({
      where: { createdAt: { gte: new Date(cursor.since) }, OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: cursor.id } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 10,
      select: { id: true, dealId: true, eventType: true, createdAt: true, deal: { select: { sellerId: true, buyerId: true } } },
    });
    if (!rows.length) {
      // Cyclic reconciliation also catches late commits with older DB timestamps.
      // Remote idempotency keeps these replays free of duplicate notifications.
      await this.request('/cursor', { from: cursor, reset: true });
      return { processed: 0 };
    }
    const deadline = Date.now() + 12000;
    let last = rows[0];
    let processed = 0;
    for (const event of rows) {
      if (processed && Date.now() >= deadline) break;
      last = event; processed++;
      const text = eventTexts[event.eventType];
      if (!text) continue;
      const recipients = [...new Set([event.deal.sellerId, event.deal.buyerId].filter((id): id is string => Boolean(id)))];
      await Promise.all(recipients.map(externalId => this.request('/events', {
        eventId: event.id, externalId, eventType: event.eventType,
        text: `Amanat Deal: ${text} Откройте сделку в личном кабинете.`,
      })));
    }
    await this.request('/cursor', { from: cursor, to: { at: last.createdAt.toISOString(), id: last.id } });
    return { processed };
  }
}
