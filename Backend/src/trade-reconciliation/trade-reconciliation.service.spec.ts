import { Test, TestingModule } from '@nestjs/testing';
import { TradeReconciliationService } from './trade-reconciliation.service';

describe('TradeReconciliationService', () => {
  let service: TradeReconciliationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradeReconciliationService],
    }).compile();

    service = module.get<TradeReconciliationService>(TradeReconciliationService);
  });

  it('detects discrepancies across trade sources', () => {
    service.ingestTrades('exchange-a', [
      {
        tradeId: 'trade-1',
        marketId: 'market-1',
        amount: 100,
        status: 'pending',
      },
    ]);

    service.ingestTrades('exchange-b', [
      {
        tradeId: 'trade-1',
        marketId: 'market-1',
        amount: 125,
        status: 'pending',
      },
    ]);

    const result = service.reconcile();
    expect(result.report.discrepanciesFound).toBe(1);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].fields).toContain('amount');
  });

  it('auto-resolves when one source confirms and others are pending', () => {
    service.ingestTrades('ledger', [
      {
        tradeId: 'trade-2',
        marketId: 'market-2',
        amount: 200,
        status: 'confirmed',
      },
    ]);

    service.ingestTrades('gateway', [
      {
        tradeId: 'trade-2',
        marketId: 'market-2',
        amount: 200,
        status: 'pending',
      },
    ]);

    const result = service.reconcile();
    expect(result.report.resolvedCount).toBe(1);

    const resolved = service.getDiscrepancies('RESOLVED');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolutionStatus).toBe('RESOLVED');
  });
});
