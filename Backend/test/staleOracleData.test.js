const oracleService = require('../services/oracleService');
const tradeValidator = require('../services/tradeValidator');
const {
  validateOracleFreshness,
  validateTradeRequest,
} = require('../middleware/tradeValidation');

/** Minimal Express response double for middleware testing */
function makeRes() {
  const listeners = {};
  const res = {
    statusCode: null,
    body: null,
    headersSent: false,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      (listeners.finish || []).forEach((fn) => fn());
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    once(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
    },
  };
  return res;
}

describe('Oracle Data Staleness Detection', () => {
  const now = new Date('2026-09-26T23:30:00.000Z');

  describe('checkOracleFreshness', () => {
    it('evaluates fresh oracle pricing data correctly', () => {
      // 10 seconds old (max 60s)
      const freshTime = new Date('2026-09-26T23:29:50.000Z');
      const result = oracleService.checkOracleFreshness(freshTime, { now, maxAgeSeconds: 60 });

      expect(result.isStale).toBe(false);
      expect(result.isBorderline).toBe(false);
      expect(result.status).toBe('fresh');
      expect(result.ageSeconds).toBe(10);
      expect(result.maxAgeSeconds).toBe(60);
      expect(result.oracleTimestamp).toBe(freshTime.toISOString());
    });

    it('evaluates borderline oracle pricing data correctly', () => {
      // 40 seconds old (borderline is >= 30s, max 60s)
      const borderlineTime = new Date('2026-09-26T23:29:20.000Z');
      const result = oracleService.checkOracleFreshness(borderlineTime, { now, maxAgeSeconds: 60 });

      expect(result.isStale).toBe(false);
      expect(result.isBorderline).toBe(true);
      expect(result.status).toBe('borderline');
      expect(result.ageSeconds).toBe(40);
      expect(result.maxAgeSeconds).toBe(60);
    });

    it('evaluates stale oracle pricing data correctly', () => {
      // 120 seconds old (exceeds max 60s)
      const staleTime = new Date('2026-09-26T23:28:00.000Z');
      const result = oracleService.checkOracleFreshness(staleTime, { now, maxAgeSeconds: 60 });

      expect(result.isStale).toBe(true);
      expect(result.isBorderline).toBe(false);
      expect(result.status).toBe('stale');
      expect(result.ageSeconds).toBe(120);
      expect(result.maxAgeSeconds).toBe(60);
    });

    it('respects custom maxAgeSeconds thresholds', () => {
      // 15 seconds old with a tight 10 second threshold
      const time = new Date('2026-09-26T23:29:45.000Z');
      const result = oracleService.checkOracleFreshness(time, { now, maxAgeSeconds: 10 });

      expect(result.isStale).toBe(true);
      expect(result.status).toBe('stale');
      expect(result.ageSeconds).toBe(15);
      expect(result.maxAgeSeconds).toBe(10);
    });

    it('handles invalid or missing timestamps as stale', () => {
      const result = oracleService.checkOracleFreshness(null, { now, maxAgeSeconds: 60 });

      expect(result.isStale).toBe(true);
      expect(result.status).toBe('stale');
      expect(result.oracleTimestamp).toBeNull();
      expect(result.message).toContain('Invalid or missing');
    });
  });

  describe('tradeValidator.validateOracleFreshness', () => {
    it('passes for fresh oracle pricing', async () => {
      const freshTime = new Date('2026-09-26T23:29:55.000Z');
      const result = await tradeValidator.validateOracleFreshness(
        { pair: 'ETH-USDT', oracleTimestamp: freshTime },
        { now, maxAgeSeconds: 60 }
      );

      expect(result.valid).toBe(true);
      expect(result.freshness.status).toBe('fresh');
      expect(result.freshness.isStale).toBe(false);
    });

    it('issues a warning for borderline oracle pricing', async () => {
      const borderlineTime = new Date('2026-09-26T23:29:25.000Z');
      const result = await tradeValidator.validateOracleFreshness(
        { pair: 'ETH-USDT', oracleTimestamp: borderlineTime },
        { now, maxAgeSeconds: 60 }
      );

      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.freshness.status).toBe('borderline');
    });

    it('rejects stale oracle pricing when blocking is enabled', async () => {
      const staleTime = new Date('2026-09-26T23:25:00.000Z');
      const result = await tradeValidator.validateOracleFreshness(
        { pair: 'ETH-USDT', oracleTimestamp: staleTime },
        { now, maxAgeSeconds: 60, onStale: 'block' }
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe('STALE_ORACLE_DATA');
      expect(result.message).toContain('stale');
      expect(result.freshness.isStale).toBe(true);
    });

    it('allows stale oracle pricing with a warning when onStale is warn', async () => {
      const staleTime = new Date('2026-09-26T23:25:00.000Z');
      const result = await tradeValidator.validateOracleFreshness(
        { pair: 'ETH-USDT', oracleTimestamp: staleTime },
        { now, maxAgeSeconds: 60, onStale: 'warn' }
      );

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('stale');
      expect(result.freshness.isStale).toBe(true);
    });
  });

  describe('validateOracleFreshness Middleware', () => {
    it('allows request through when oracle pricing is fresh', async () => {
      const freshTime = new Date('2026-09-26T23:29:50.000Z');
      const req = { body: { pair: 'BTC-USDT', oracleTimestamp: freshTime } };
      const res = makeRes();
      const next = jest.fn();

      const middleware = validateOracleFreshness({ now, maxAgeSeconds: 60 });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.oracleFreshness).toBeDefined();
      expect(req.oracleFreshness.status).toBe('fresh');
      expect(res.headers['X-Oracle-Freshness']).toBeDefined();
    });

    it('blocks request with 400 and freshness payload when oracle pricing is stale', async () => {
      const staleTime = new Date('2026-09-26T23:20:00.000Z');
      const req = { body: { pair: 'BTC-USDT', oracleTimestamp: staleTime } };
      const res = makeRes();
      const next = jest.fn();

      const middleware = validateOracleFreshness({ now, maxAgeSeconds: 60, onStale: 'block' });
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('STALE_ORACLE_DATA');
      expect(res.body.oracleFreshness).toBeDefined();
      expect(res.body.oracleFreshness.isStale).toBe(true);
      expect(res.body.oracleFreshness.ageSeconds).toBe(600);
    });
  });

  describe('getPrice staleness rejection', () => {
    it('throws STALE_ORACLE_DATA when rejectIfStale is set and pricing is stale', async () => {
      const staleTime = new Date('2026-09-26T23:10:00.000Z');
      const PriceHistory = require('../models/PriceHistory');
      jest.spyOn(PriceHistory, 'findOne').mockReturnValueOnce({
        sort: () => Promise.resolve({ price: '2000', timestamp: staleTime }),
      });

      await expect(
        oracleService.getPrice('ETH/USD', null, { rejectIfStale: true, now, maxAgeSeconds: 60 })
      ).rejects.toThrow(/Stale oracle pricing data/);
    });
  });
});
