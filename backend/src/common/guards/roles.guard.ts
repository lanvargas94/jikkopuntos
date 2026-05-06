import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '../constants/roles';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtUserPayload } from '../interfaces/jwt-user-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Autenticación requerida');
    }
    if (!required.includes(user.roleCode)) {
      throw new ForbiddenException(
        'No tienes permiso para esta acción (rol insuficiente)',
      );
    }
    return true;
  }
}
