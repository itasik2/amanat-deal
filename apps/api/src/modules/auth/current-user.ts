import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PublicUser } from './auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const request = context.switchToHttp().getRequest<{ user?: PublicUser }>();
    if (!request.user) throw new UnauthorizedException('Требуется вход в аккаунт');
    return request.user;
  }
);
