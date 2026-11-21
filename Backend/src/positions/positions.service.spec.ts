import { PositionsService, decimalRatio } from './positions.service';
import { StoredPosition } from './position.schema';

describe('exact position presentation', () => {
  const service = new PositionsService(null as any, null as any, null as any);
  const present = (p: StoredPosition) => (service as any).present(p);
  const holding: StoredPosition = {
    id: 'p', userId: 'u', account: 'a', chainId: '1', contract: 'c', marketId: '0', side: 'YES',
    shareUnits: '10000000000000000000', costUnits: '3000000000000000000',
    realizedUnits: '0', priceUnits: '500000000000000000', lastBlock: 1, lastLog: 0, openedAt: new Date(),
  };
  it('uses held outcome prices for both YES and NO', () => {
    for (const side of ['YES', 'NO'] as const) {
      const p = present({ ...holding, side });
      expect(p.pnl).toBe('2.000000000000000000');
      expect(p.entryPrice).toBe('0.300000000000000000');
    }
  });
  it('preserves units above Number.MAX_SAFE_INTEGER', () => {
    expect(decimalRatio(9007199254740993000000000000000001n, 10n ** 18n)).toBe('9007199254740993.000000000000000001');
  });
  it('rounds ties away from zero', () => {
    expect(decimalRatio(1n, 8n, 2)).toBe('0.13');
    expect(decimalRatio(-1n, 8n, 2)).toBe('-0.13');
  });
  it('keeps realized profit after closing and has no remaining risk', () => {
    const p = present({ ...holding, shareUnits: '0', costUnits: '0', realizedUnits: '2000000000000000000' });
    expect(p.status).toBe('closed');
    expect(p.pnl).toBe('0.000000000000000000');
    expect(p.realizedPnl).toBe('2.000000000000000000');
    expect(p.maxLoss).toBe('0.000000000000000000');
  });
});
