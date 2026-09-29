const restoreService = require('../services/restoreService');

describe('RestoreService', () => {
  it('handles restore requests and tracks progress', async () => {
    const result = await restoreService.requestRestore({
      restoreId: 'restore-1',
      requestedBy: 'tester',
      data: {
        marketId: 'BTC-USD',
        snapshot: { price: 100, volume: 50 },
      },
    });

    expect(result.restoreId).toBe('restore-1');
    expect(result.status).toBe('completed');
    expect(result.progress.percent).toBe(100);
    expect(result.result.restoredItems).toBe(1);
  });

  it('validates invalid restore payloads', async () => {
    const result = await restoreService.requestRestore({
      restoreId: 'restore-invalid',
      data: { foo: 'bar' },
    });

    expect(result.status).toBe('invalid');
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });
});
