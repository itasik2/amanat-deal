import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PhoneAuthService } from './phone-auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SmsService } from './sms.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PhoneAuthService, SessionAuthGuard, SmsService],
  exports: [AuthService, PhoneAuthService, SessionAuthGuard, SmsService]
})
export class AuthModule {}
