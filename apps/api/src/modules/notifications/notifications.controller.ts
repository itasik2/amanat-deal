import { Controller, Get, Headers, Post, UnauthorizedException, UseGuards, Header } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import type { PublicUser } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() @Header('Cache-Control', 'no-store') status(@CurrentUser() user: PublicUser) { return this.service.status(user); }
  @Post('connect') @Header('Cache-Control', 'no-store') connect(@CurrentUser() user: PublicUser) { return this.service.connect(user); }
}
@Controller('internal/automation')
export class NotificationAutomationController {
  constructor(private readonly service: NotificationsService) {}
  @Get('auth-readiness') @Header('Cache-Control', 'no-store') readiness(@Headers('authorization') authorization?: string) {
    const secret = process.env.NOTIFY_DISPATCH_SECRET?.trim();
    if (!secret || authorization !== 'Bearer ' + secret) throw new UnauthorizedException();
    return this.service.authReadiness();
  }
  @Get('notifications') @Header('Cache-Control', 'no-store') dispatch(@Headers('authorization') authorization?: string) {
    const secret = process.env.NOTIFY_DISPATCH_SECRET?.trim();
    if (!secret || authorization !== 'Bearer ' + secret) throw new UnauthorizedException();
    return this.service.dispatch();
  }
}
