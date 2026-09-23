import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type OtpDeliveryResult =
  | { mode: 'debug'; debugCode: string }
  | { mode: 'webhook' };

@Injectable()
export class OtpDeliveryService {
  ensureConfigured() {
    if (this.debugEnabled()) return;

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

  private debugEnabled() {
    return process.env.OTP_DEBUG_CODE_ENABLED === 'true';
  }

  private webhookUrl() {
    const value = process.env.OTP_DELIVERY_WEBHOOK_URL?.trim();
    return value || undefined;
  }

  private timeoutMs() {
    const configured = Number(process.env.OTP_DELIVERY_TIMEOUT_MS ?? 8000);
    return Number.isFinite(configured) && configured >= 1000 ? configured : 8000;
  }
}
