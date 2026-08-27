import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MarketAuditAdminGuard } from './market-audit-admin.guard';

describe('MarketAuditAdminGuard', () => {
  const contextFor = (user?: { id?: string }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  afterEach(() => {
    delete process.env.MARKET_AUDIT_ADMIN_IDS;
  });

  it('rejects missing configuration and missing principals', () => {
    const guard = new MarketAuditAdminGuard();

    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('rejects authenticated users outside the allowlist', () => {
    process.env.MARKET_AUDIT_ADMIN_IDS = 'admin-1, admin-2';
    const guard = new MarketAuditAdminGuard();

    expect(() => guard.canActivate(contextFor({ id: 'user-1' }))).toThrow(
      ForbiddenException,
    );
  });

  it('accepts an authenticated user in the allowlist', () => {
    process.env.MARKET_AUDIT_ADMIN_IDS = 'admin-1, admin-2';
    const guard = new MarketAuditAdminGuard();

    expect(guard.canActivate(contextFor({ id: 'admin-2' }))).toBe(true);
  });
});
