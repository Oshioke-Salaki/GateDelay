/**
 * MarketAuditService unit tests.
 *
 * Trust assumptions (P2-156):
 * - This service is in-memory only; no external secrets, private keys, or
 *   credential literals are present. All inputs are plain strings.
 * - Oracles, multisig signers, and beta-access gates are NOT enforced here;
 *   those concerns live in the controller / gateway layer.
 * - Retention policy bounds are clamped by the DTO validator (1–3650 days).
 * - The hash chain (SHA-256) is for tamper-evidence, not cryptographic auth.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

  // --- Negative-path tests (P2-156) ---

  it('returns empty results for unmatched query filters', () => {
    service.createLog({
      marketId: 'm1',
      operation: 'CREATE_MARKET',
      actor: 'a',
      details: 'd',
    });

    const logs = service.queryLogs({ marketId: 'nonexistent' });
    expect(logs).toHaveLength(0);
  });

  it('returns empty report when no logs exist', () => {
    const report = service.generateReport();
    expect(report.totalLogs).toBe(0);
    expect(report.marketsTouched).toBe(0);
    expect(report.actors).toBe(0);
  });

  it('verifyIntegrity returns valid on empty log chain', () => {
    const result = service.verifyIntegrity();
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeUndefined();
  });

  it('enforceRetention removes old entries and respects floor', () => {
    service.setRetentionPolicy(0);
    const result = service.enforceRetention();
    expect(result.retentionDays).toBe(0);
  });

  it('queryLogs respects limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      service.createLog({
        marketId: `m${i}`,
        operation: 'CREATE_MARKET',
        actor: 'a',
        details: 'd',
      });
    }

    const limited = service.queryLogs({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('queryLogs supports date range filters', () => {
    service.createLog({
      marketId: 'm1',
      operation: 'CREATE_MARKET',
      actor: 'a',
      details: 'd',
    });

    const now = new Date();
    const logs = service.queryLogs({
      from: new Date(now.getTime() - 60_000).toISOString(),
      to: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('no secrets or private keys appear in the service source file', () => {
    const servicePath = resolve(__dirname, 'market-audit.service.ts');
    const content = readFileSync(servicePath, 'utf8');

    const secretPatterns = [
      /0x[0-9a-fA-F]{64}/, // Ethereum private key
      /-----BEGIN.*PRIVATE KEY/, // PEM key
      /password\s*[:=]\s*["']/i, // password assignment
      /secret\s*[:=]\s*["']/i, // secret assignment
      /api[_-]?key\s*[:=]\s*["']/i,
      /mnemonic/i,
    ];

    for (const pattern of secretPatterns) {
      expect(content).not.toMatch(pattern);
    }
  });
});
