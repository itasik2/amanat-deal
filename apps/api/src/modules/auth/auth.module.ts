import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PhoneAuthService } from './phone-auth.service';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PhoneAuthService, SessionAuthGuard],
  exports: [AuthService, PhoneAuthService, SessionAuthGuard]
})
export class AuthModule {}
