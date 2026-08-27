import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: { id?: string };
};

@Injectable()
export class MarketAuditAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    const adminIds = this.getAdminIds();

    if (!userId || !adminIds.has(userId)) {
      throw new ForbiddenException(
        'Market audit administrator access required',
      );
    }

    return true;
  }

  private getAdminIds(): Set<string> {
    return new Set(
      (process.env.MARKET_AUDIT_ADMIN_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }
}
