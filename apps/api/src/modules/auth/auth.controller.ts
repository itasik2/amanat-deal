import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string; name?: string },
    @Res({ passthrough: true }) response: Response
  ) {
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
}
