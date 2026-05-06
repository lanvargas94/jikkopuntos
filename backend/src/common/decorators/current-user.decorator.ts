import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUserPayload }>();
    return request.user;
  },
);
