import { Test, TestingModule } from '@nestjs/testing';
import { MarketAuditService } from './market-audit.service';

describe('MarketAuditService', () => {
  let service: MarketAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketAuditService],
    }).compile();

    service = module.get<MarketAuditService>(MarketAuditService);
  });

  it('logs operations and supports query filtering', () => {
    service.createLog({
      marketId: 'market-1',
      operation: 'CREATE_MARKET',
      actor: 'system',
      details: 'Created new market',
    });

    service.createLog({
      marketId: 'market-2',
      operation: 'RESOLVE_MARKET',
      actor: 'oracle',
      details: 'Resolved market',
      severity: 'HIGH',
    });

    const logs = service.queryLogs({ marketId: 'market-2' });
    expect(logs).toHaveLength(1);
    expect(logs[0].operation).toBe('RESOLVE_MARKET');
  });

  it('redacts credential-like values before storing audit details', () => {
    const log = service.createLog({
      marketId: 'market-4',
      operation: 'SECURITY_EVENT',
      actor: 'admin',
      details:
        'authorization: Bearer top-secret-token api_key=abc123 private_key=0x' +
        'a'.repeat(64),
    });

    expect(log.details).toContain('authorization: Bearer [REDACTED]');
    expect(log.details).toContain('api_key=[REDACTED]');
    expect(log.details).toContain('private_key=[REDACTED]');
    expect(log.details).not.toContain('top-secret-token');
    expect(log.details).not.toContain('abc123');

    expect(service.verifyIntegrity().valid).toBe(true);
  });

  it('produces summary report and validates integrity chain', () => {
    service.createLog({
      marketId: 'market-3',
      operation: 'UPDATE_ODDS',
      actor: 'trader-a',
      details: 'Odds update',
      severity: 'MEDIUM',
    });

    service.createLog({
      marketId: 'market-3',
      operation: 'UPDATE_ODDS',
      actor: 'trader-b',
      details: 'Second odds update',
      severity: 'LOW',
    });

    const report = service.generateReport();
    expect(report.totalLogs).toBe(2);
    expect(report.byOperation.UPDATE_ODDS).toBe(2);
    expect(report.bySeverity.MEDIUM).toBe(1);

    const integrity = service.verifyIntegrity();
    expect(integrity.valid).toBe(true);
  });
});
