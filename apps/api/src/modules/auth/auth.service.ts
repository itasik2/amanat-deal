import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE_NAME = 'amanat_session';

export type PublicUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: { email?: string; password?: string; name?: string }) {
    const email = this.normalizeEmail(input.email);
    const password = this.validatePassword(input.password);
    const name = input.name?.trim() || undefined;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Пользователь с таким email уже существует');

    const passwordHash = await this.hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, name, passwordHash }
    });

    return this.issueSession(user);
  }

  async login(input: { email?: string; password?: string }) {
    const email = this.normalizeEmail(input.email);
    const password = input.password ?? '';
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueSession(user);
  }

  async requireUser(cookieHeader?: string): Promise<PublicUser> {
    const token = this.readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (!token) throw new UnauthorizedException('Требуется вход в аккаунт');

    const tokenHash = this.hashToken(token);
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Сессия истекла или недействительна');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() }
    });

    return this.publicUser(session.user);
  }

  async logout(cookieHeader?: string) {
    const token = this.readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (!token) return;

    await this.prisma.userSession.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  sessionCookieOptions(expiresAt?: Date) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      expires: expiresAt
    };
  }

  private async issueSession(user: {
    id: string;
    email: string | null;
    phone: string | null;
    name: string | null;
  }) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.sessionTtlDays() * 24 * 60 * 60 * 1000
    );

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt
      }
    });

    return {
      user: this.publicUser(user),
      sessionToken: token,
      expiresAt
    };
  }

  private publicUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
    name: string | null;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name
    };
  }

  private normalizeEmail(value?: string) {
    const email = value?.trim().toLowerCase() ?? '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Укажите корректный email');
    }
    return email;
  }

  private validatePassword(value?: string) {
    const password = value ?? '';
    if (password.length < 8) {
      throw new BadRequestException('Пароль должен содержать не менее 8 символов');
    }
    if (password.length > 200) {
      throw new BadRequestException('Пароль слишком длинный');
    }
    return password;
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16);
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, encoded: string) {
    const [algorithm, saltHex, hashHex] = encoded.split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

    try {
      const expected = Buffer.from(hashHex, 'hex');
      const derived = (await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
      return expected.length === derived.length && timingSafeEqual(expected, derived);
    } catch {
      return false;
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private readCookie(header: string | undefined, name: string) {
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const index = part.indexOf('=');
      if (index < 0) continue;
      const key = part.slice(0, index).trim();
      if (key !== name) continue;
      return decodeURIComponent(part.slice(index + 1).trim());
    }
    return undefined;
  }

  private sessionTtlDays() {
    const configured = Number(process.env.AUTH_SESSION_TTL_DAYS ?? 30);
    return Number.isFinite(configured) && configured > 0 ? configured : 30;
  }
}
