import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const granted = new Set(
      [user.role, ...(Array.isArray(user.roles) ? user.roles : [])]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase()),
    );

    const match = requiredRoles.some((role) => granted.has(role.toLowerCase()));
    if (!match) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
