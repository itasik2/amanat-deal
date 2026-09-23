import { Body, Controller, Get, NotFoundException, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';
import { PhoneAuthService } from './phone-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly phoneAuth: PhoneAuthService
  ) {}

  @Post('phone/request-code')
  requestPhoneCode(@Body() body: { phone?: string }) {
    return this.phoneAuth.requestCode(body);
  }

  @Post('phone/verify')
  async verifyPhone(
    @Body() body: { phone?: string; code?: string; name?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.phoneAuth.verifyCode(body);
    response.cookie(
      SESSION_COOKIE_NAME,
      session.sessionToken,
      this.auth.sessionCookieOptions(session.expiresAt)
    );
    return { user: session.user, expiresAt: session.expiresAt };
  }

  // Legacy pilot email/password endpoints remain available while existing
  // test accounts are migrated to phone-first authentication.
  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string; name?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureLegacyEmailAuthEnabled();
    const session = await this.auth.register(body);
    response.cookie(
      SESSION_COOKIE_NAME,
      session.sessionToken,
      this.auth.sessionCookieOptions(session.expiresAt)
    );
    return { user: session.user, expiresAt: session.expiresAt };
  }

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response
  ) {
    this.ensureLegacyEmailAuthEnabled();
    const session = await this.auth.login(body);
    response.cookie(
      SESSION_COOKIE_NAME,
      session.sessionToken,
      this.auth.sessionCookieOptions(session.expiresAt)
    );
    return { user: session.user, expiresAt: session.expiresAt };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.headers.cookie);
    response.clearCookie(SESSION_COOKIE_NAME, this.auth.sessionCookieOptions());
    return { ok: true };
  }

  @Get('me')
  async me(@Req() request: Request) {
    return { user: await this.auth.requireUser(request.headers.cookie) };
  }

  private ensureLegacyEmailAuthEnabled() {
    const configured = process.env.LEGACY_EMAIL_AUTH_ENABLED;
    const enabled = configured === 'true' ||
      (configured !== 'false' && process.env.NODE_ENV !== 'production');

    if (!enabled) {
      throw new NotFoundException('Legacy email authentication is disabled');
    }
  }
}
