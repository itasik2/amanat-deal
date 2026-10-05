import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type OtpDeliveryResult =
  | { mode: 'debug'; debugCode: string }
  | { mode: 'webhook' }
  | { mode: 'notify' };

@Injectable()
export class OtpDeliveryService {
  ensureConfigured() {
    if (this.debugEnabled() || this.notifyConfigured()) return;

    if (!this.webhookUrl()) {
      throw new ServiceUnavailableException(
        'Отправка SMS временно недоступна: транспорт OTP не настроен'
      );
    }
  }

  async deliver(input: { phone: string; code: string; expiresAt: Date }): Promise<OtpDeliveryResult> {
    if (this.debugEnabled()) {
      return { mode: 'debug', debugCode: input.code };
    }

    if (this.notifyConfigured()) return this.deliverNotify(input);

    const url = this.webhookUrl();
    if (!url) {
      throw new ServiceUnavailableException(
        'Отправка SMS временно недоступна: транспорт OTP не настроен'
      );
    }

    const timeoutMs = this.timeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json'
      };
      const token = process.env.OTP_DELIVERY_WEBHOOK_TOKEN?.trim();
      if (token) headers.authorization = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          channel: 'sms',
          to: input.phone,
          purpose: 'login_otp',
          message: `Amanat Deal: код входа ${input.code}. Никому не сообщайте этот код.`,
          expiresAt: input.expiresAt.toISOString()
        })
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `SMS transport returned HTTP ${response.status}`
        );
      }

      return { mode: 'webhook' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;

      throw new ServiceUnavailableException(
        error instanceof Error && error.name === 'AbortError'
          ? 'SMS transport timeout'
          : 'Не удалось отправить SMS-код'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private notifyConfigured() { return Boolean(process.env.NOTIFY_KZ_INTEGRATION_KEY?.trim()); }

  private async deliverNotify(input: { phone: string; code: string; expiresAt: Date }): Promise<OtpDeliveryResult> {
    try {
      const base = new URL(process.env.NOTIFY_KZ_API_URL || 'https://notify-kz-api.vercel.app');
      if (base.protocol !== 'https:') throw new Error('HTTPS required');
      const response = await fetch(base.origin + '/v1/integration-api/login-otp', {
        method: 'POST', redirect: 'error',
        headers: { authorization: 'Bearer ' + process.env.NOTIFY_KZ_INTEGRATION_KEY!.trim(), 'content-type': 'application/json' },
        body: JSON.stringify({ phone: input.phone, code: input.code, expiresAt: input.expiresAt.toISOString() }),
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
      if (!response.ok) throw new Error('Notify rejected OTP');
      return { mode: 'notify' };
    } catch {
      // Never echo provider data or the OTP in public errors.
      throw new ServiceUnavailableException('Не удалось поставить SMS-код в очередь. Попробуйте позже.');
    }
  }

  private debugEnabled() {
    return process.env.NODE_ENV !== 'production' &&
      process.env.OTP_DEBUG_CODE_ENABLED === 'true';
  }

  private webhookUrl() {
    const value = process.env.OTP_DELIVERY_WEBHOOK_URL?.trim();
    if (!value) return undefined;

    try {
      const url = new URL(value);
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new Error('Production OTP webhook must use HTTPS');
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('OTP webhook must use HTTP or HTTPS');
      }
      return url.toString();
    } catch {
      throw new ServiceUnavailableException('OTP delivery webhook URL is invalid');
    }
  }

  private timeoutMs() {
    const configured = Number(process.env.OTP_DELIVERY_TIMEOUT_MS ?? 8000);
    return Number.isFinite(configured) && configured >= 1000 ? configured : 8000;
  }
}

