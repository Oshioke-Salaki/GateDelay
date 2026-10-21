import { BadRequestException } from '@nestjs/common';
import { TradingHistoryService } from './trading-history.service';

describe('TradingHistoryService UTC date filters', () => {
  let service: TradingHistoryService;

  beforeEach(() => {
    service = new TradingHistoryService();
  });

  function addTrade(createdAt: string) {
    const trade = service.recordTrade('user-1', {
      userId: 'user-1',
      marketId: 'market-1',
      type: 'buy',
      amount: 1,
      status: 'confirmed',
    });
    trade.createdAt = new Date(createdAt);
  }

  it('includes the UTC start and selected end day but excludes next-day midnight', () => {
    addTrade('2026-03-07T23:59:59.999Z');
    addTrade('2026-03-08T00:00:00.000Z');
    addTrade('2026-03-08T23:59:59.999Z');
    addTrade('2026-03-09T00:00:00.000Z');

    const result = service.getTradingHistory('user-1', {
      startDate: '2026-03-08',
      endDate: '2026-03-08',
    });

    expect(result.data.map((trade) => trade.createdAt.toISOString())).toEqual([
      '2026-03-08T00:00:00.000Z',
      '2026-03-08T23:59:59.999Z',
    ]);
  });

  it('uses the same UTC bounds regardless of the server timezone', () => {
    const originalTimezone = process.env.TZ;

    try {
      const results = ['America/Los_Angeles', 'Asia/Tokyo'].map((timezone) => {
        process.env.TZ = timezone;
        service = new TradingHistoryService();
        addTrade('2026-11-01T23:59:59.999Z');
        addTrade('2026-11-02T00:00:00.000Z');
        return service.getTradingHistory('user-1', {
          startDate: '2026-11-01',
          endDate: '2026-11-01',
        }).data.map((trade) => trade.createdAt.toISOString());
      });

      expect(results[0]).toEqual(results[1]);
      expect(results[0]).toEqual(['2026-11-01T23:59:59.999Z']);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('rejects reversed date ranges and impossible calendar dates', () => {
    expect(() =>
      service.getTradingHistory('user-1', {
        startDate: '2026-03-02',
        endDate: '2026-03-01',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.getTradingHistory('user-1', {
        startDate: '2026-02-30',
      }),
    ).toThrow(BadRequestException);
  });
});
