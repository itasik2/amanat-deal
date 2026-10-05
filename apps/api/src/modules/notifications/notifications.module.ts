import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController, NotificationAutomationController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({ imports: [AuthModule], controllers: [NotificationsController, NotificationAutomationController], providers: [NotificationsService] })
export class NotificationsModule {}
