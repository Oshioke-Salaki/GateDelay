import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RATE_LIMIT_TIER_KEY } from '../rate-limiter/rate-limiter.config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketAuditController } from './market-audit.controller';
import { MarketAuditService } from './market-audit.service';

describe('MarketAuditController security boundary', () => {
  const service = {
    createLog: jest.fn(),
    queryLogs: jest.fn(),
    setRetentionPolicy: jest.fn(),
    enforceRetention: jest.fn(),
    generateReport: jest.fn(),
    verifyIntegrity: jest.fn(),
  } as unknown as MarketAuditService;
  let controller: MarketAuditController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MarketAuditController(service);
  });

  it('requires the JWT guard for every audit endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MarketAuditController)).toEqual(
      [JwtAuthGuard],
    );
  });

  it('applies the standard rate-limit tier to prevent audit flooding', () => {
    expect(
      Reflect.getMetadata(RATE_LIMIT_TIER_KEY, MarketAuditController),
    ).toBe('standard');
  });

  it('passes validated report dates through without accepting arbitrary query keys', () => {
    controller.getReport({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(service.generateReport).toHaveBeenCalledWith(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );
  });

  it('does not mutate retention state when the optional value is absent', () => {
    controller.enforceRetention({});

    expect(service.setRetentionPolicy).not.toHaveBeenCalled();
    expect(service.enforceRetention).toHaveBeenCalledTimes(1);
  });
});
