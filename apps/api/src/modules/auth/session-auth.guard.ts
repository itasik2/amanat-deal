import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { cookie?: string };
      user?: Awaited<ReturnType<AuthService['requireUser']>>;
    }>();

    request.user = await this.auth.requireUser(request.headers.cookie);
    return true;
  }
}
