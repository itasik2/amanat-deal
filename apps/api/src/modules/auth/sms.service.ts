import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type SmsDelivery = {
  provider: 'debug' | 'mobizon';
  messageId?: string;
  exposeDebugCode: boolean;
};

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

@Injectable()
export class SmsService {
  async sendOtp(phone: string, code: string): Promise<SmsDelivery> {
    const provider = this.provider();

    if (provider === 'debug') {
      return { provider: 'debug', exposeDebugCode: true };
    }

    if (provider === 'mobizon') {
      return this.sendViaMobizon(phone, code);
    }

    throw new ServiceUnavailableException('SMS-доставка пока не настроена');
  }

  private provider() {
    const configured = process.env.SMS_PROVIDER?.trim().toLowerCase();
    if (configured) return configured;

    if (process.env.OTP_DEBUG_CODE_ENABLED === 'true') return 'debug';
    return process.env.NODE_ENV === 'production' ? 'disabled' : 'debug';
  }

  private async sendViaMobizon(phone: string, code: string): Promise<SmsDelivery> {
    const apiKey = process.env.MOBIZON_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('SMS-доставка временно недоступна');
    }

    const body = new URLSearchParams({
      recipient: digitsOnly(phone),
      text: `Amanat Deal: код входа ${code}. Никому не сообщайте этот код.`
    });

    const sender = process.env.MOBIZON_SENDER?.trim();
    if (sender) body.set('from', sender);

    const url = new URL('https://api.mobizon.kz/service/message/sendSmsMessage');
    url.searchParams.set('output', 'json');
    url.searchParams.set('api', 'v1');
    url.searchParams.set('apiKey', apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new ServiceUnavailableException('Не удалось отправить SMS. Повторите позже');
    }

    const payload = await response.json().catch(() => null) as {
      code?: number;
      message?: string;
      data?: { messageId?: number | string };
    } | null;

    if (!response.ok || payload?.code !== 0) {
      console.error('[amanat-sms] Mobizon delivery failed', {
        httpStatus: response.status,
        providerCode: payload?.code,
        providerMessage: payload?.message
      });
      throw new ServiceUnavailableException('Не удалось отправить SMS. Повторите позже');
    }

    return {
      provider: 'mobizon',
      messageId: payload.data?.messageId == null ? undefined : String(payload.data.messageId),
      exposeDebugCode: false
    };
  }
}
