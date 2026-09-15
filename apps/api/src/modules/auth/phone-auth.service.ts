import {
  BadRequestException,
  Injectable,
  TooManyRequestsException,
  UnauthorizedException
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from './auth.service';

@Injectable()
export class PhoneAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async requestCode(input: { phone?: string }) {
    const phone = this.normalizePhone(input.phone);
    const now = new Date();
    const existing = await this.prisma.phoneOtpChallenge.findUnique({ where: { phone } });

    if (existing && existing.sentAt.getTime() > now.getTime() - 60_000) {
      throw new TooManyRequestsException('Повторный код можно запросить через минуту');
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + this.otpTtlMinutes() * 60_000);

    await this.prisma.phoneOtpChallenge.upsert({
      where: { phone },
      create: {
        phone,
        codeHash: this.hashOtp(phone, code),
        expiresAt,
        sentAt: now
      },
      update: {
        codeHash: this.hashOtp(phone, code),
        expiresAt,
        sentAt: now,
        attempts: 0,
        consumedAt: null
      }
    });

    // Pilot transport. A real SMS provider can replace this without changing
    // the OTP/session contract. Do not enable OTP_DEBUG_CODE_ENABLED in production.
    console.info(`[amanat-otp] ${phone}: ${code}`);

    return {
      ok: true,
      phone: this.maskPhone(phone),
      expiresAt,
      ...(process.env.OTP_DEBUG_CODE_ENABLED === 'true' ? { debugCode: code } : {})
    };
  }

  async verifyCode(input: { phone?: string; code?: string; name?: string }) {
    const phone = this.normalizePhone(input.phone);
    const code = String(input.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Введите 6-значный код');

    const challenge = await this.prisma.phoneOtpChallenge.findUnique({ where: { phone } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException('Код истёк. Запросите новый');
    }
    if (challenge.attempts >= 5) {
      throw new UnauthorizedException('Слишком много попыток. Запросите новый код');
    }

    const matches = challenge.codeHash === this.hashOtp(phone, code);
    if (!matches) {
      await this.prisma.phoneOtpChallenge.update({
        where: { phone },
        data: { attempts: { increment: 1 } }
      });
      throw new UnauthorizedException('Неверный код');
    }

    const name = input.name?.trim() || undefined;
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.phoneOtpChallenge.update({
        where: { phone },
        data: { consumedAt: new Date() }
      });

      return tx.user.upsert({
        where: { phone },
        create: { phone, name },
        update: name ? { name } : {}
      });
    });

    return this.issueSession(user);
  }

  normalizePhone(value?: string) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    if (digits.length === 10) digits = `7${digits}`;
    if (!/^7\d{10}$/.test(digits)) {
      throw new BadRequestException('Укажите корректный номер Казахстана');
    }
    return `+${digits}`;
  }

  maskPhone(phone: string) {
    return `${phone.slice(0, 4)} *** *** ${phone.slice(-2)}`;
  }

  private async issueSession(user: {
    id: string;
    email: string | null;
    phone: string | null;
    name: string | null;
  }) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlDays() * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt
      }
    });

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name
    };

    return { user: publicUser, sessionToken: token, expiresAt };
  }

  private hashOtp(phone: string, code: string) {
    const secret = this.otpSecret();
    return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
  }

  private otpSecret() {
    const configured = process.env.OTP_HASH_SECRET?.trim();
    if (configured) return configured;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTP_HASH_SECRET must be configured in production');
    }
    return 'amanat-deal-dev-otp-secret';
  }

  private otpTtlMinutes() {
    const configured = Number(process.env.OTP_TTL_MINUTES ?? 5);
    return Number.isFinite(configured) && configured > 0 ? configured : 5;
  }

  private sessionTtlDays() {
    const configured = Number(process.env.AUTH_SESSION_TTL_DAYS ?? 30);
    return Number.isFinite(configured) && configured > 0 ? configured : 30;
  }
}
