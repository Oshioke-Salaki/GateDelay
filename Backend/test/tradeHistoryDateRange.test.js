const { buildTradeHistoryTimestampFilter } = require('../utils/tradeHistoryDateRange');

describe('buildTradeHistoryTimestampFilter', () => {
  it('uses an inclusive UTC start and an exclusive midnight after the selected end date', () => {
    const filter = buildTradeHistoryTimestampFilter('2026-03-08', '2026-03-08');

    expect(filter.$gte.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(filter.$lt.toISOString()).toBe('2026-03-09T00:00:00.000Z');

    const start = Date.parse('2026-03-08T00:00:00.000Z');
    const finalMillisecond = Date.parse('2026-03-08T23:59:59.999Z');
    const nextDayBoundary = Date.parse('2026-03-09T00:00:00.000Z');
    expect(start >= filter.$gte.getTime()).toBe(true);
    expect(finalMillisecond < filter.$lt.getTime()).toBe(true);
    expect(nextDayBoundary < filter.$lt.getTime()).toBe(false);
  });

  it('produces identical bounds regardless of the server timezone', () => {
    const originalTimezone = process.env.TZ;

    try {
      const filters = ['America/Los_Angeles', 'Asia/Tokyo'].map((timezone) => {
        process.env.TZ = timezone;
        const filter = buildTradeHistoryTimestampFilter('2026-11-01', '2026-11-01');
        return [filter.$gte.toISOString(), filter.$lt.toISOString()];
      });

      expect(filters[0]).toEqual(filters[1]);
      expect(filters[0]).toEqual([
        '2026-11-01T00:00:00.000Z',
        '2026-11-02T00:00:00.000Z',
      ]);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('rejects impossible and reversed date ranges', () => {
    expect(() => buildTradeHistoryTimestampFilter('2026-02-30', '2026-03-01')).toThrow(
      'startDate must be a valid calendar date',
    );
    expect(() => buildTradeHistoryTimestampFilter('2026-03-02', '2026-03-01')).toThrow(
      'startDate must be on or before endDate',
    );
  });
});
