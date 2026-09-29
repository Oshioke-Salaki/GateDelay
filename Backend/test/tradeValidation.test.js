jest.mock('../services/tradeValidator');

const tradeValidator = require('../services/tradeValidator');
const {
  validateTradeLimits,
  validateTradeBalance,
  validateTrade,
} = require('../middleware/tradeValidation');

/**
 * Regression tests for Backend/middleware/tradeValidation.js.
 *
 * Weighted to the paths that were silently wrong: a falsy `0` amount skipping
 * the minimum-amount floor, a malformed number surfacing as a 500, a
 * single-token pair reaching the balance lookup, and the combinator hanging
 * forever when a validator answered the request instead of calling next().
 */

const LIMITS = {
  MIN_TRADE_AMOUNT: '0.0001',
  MAX_TRADE_AMOUNT: '1000000',
  MIN_TRADE_PRICE: '0.00000001',
  MAX_TRADE_PRICE: '10000000',
};

/** Minimal Express double: records the status/body and emits 'finish'. */
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

beforeEach(() => {
  jest.clearAllMocks();
  tradeValidator.TRADE_LIMITS = LIMITS;
});

describe('validateTradeLimits', () => {
  it('rejects a zero amount instead of skipping the floor', async () => {
    const req = { body: { amount: 0 } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    // `if (amount)` treated 0 as "nothing to check" and called next().
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('LIMITS_EXCEEDED');
    expect(res.body.errors[0].field).toBe('amount');
  });

  it('rejects a zero-amount limit order on price as well', async () => {
    const req = { body: { amount: '1', type: 'Limit', price: 0 } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body.errors.some((e) => e.field === 'price')).toBe(true);
  });

  it('accepts an amount inside the limits', async () => {
    const req = { body: { amount: '1.5' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it('rejects an amount above the maximum', async () => {
    const req = { body: { amount: '2000000' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 400, not 500, for a non-numeric amount', async () => {
    const req = { body: { amount: 'not-a-number' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    // new Big('not-a-number') throws; that is bad input, not a server fault.
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_NUMBER');
    expect(next).not.toHaveBeenCalled();
  });

  it('skips validation when no amount is supplied at all', async () => {
    const req = { body: {} };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeLimits(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('validateTradeBalance', () => {
  it('rejects a pair that is not BASE-QUOTE', async () => {
    const req = { body: { userId: 'u1', pair: 'BTC', amount: '1' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeBalance(req, res, next);

    // 'BTC'.split('-') → ['BTC'], so quoteAsset was undefined and the balance
    // lookup ran against an undefined asset.
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_PAIR');
    expect(tradeValidator.validateBalance).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('locks the quote asset when buying', async () => {
    tradeValidator.validateBalance.mockResolvedValue({ valid: true });
    const req = { body: { userId: 'u1', pair: 'BTC-USDT', side: 'Buy', amount: '2' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeBalance(req, res, next);

    expect(tradeValidator.validateBalance).toHaveBeenCalledWith('u1', 'USDT', '2');
    expect(next).toHaveBeenCalled();
  });

  it('multiplies price by amount for a limit buy', async () => {
    tradeValidator.validateBalance.mockResolvedValue({ valid: true });
    const req = {
      body: { userId: 'u1', pair: 'BTC-USDT', side: 'Buy', type: 'Limit', amount: '2', price: '30000' },
    };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeBalance(req, res, next);

    expect(tradeValidator.validateBalance).toHaveBeenCalledWith('u1', 'USDT', '60000');
  });

  it('surfaces an insufficient balance as 400', async () => {
    tradeValidator.validateBalance.mockResolvedValue({
      valid: false,
      message: 'Insufficient balance',
      available: '1',
      required: '2',
      shortfall: '1',
    });
    const req = { body: { userId: 'u1', pair: 'BTC-USDT', side: 'Sell', amount: '2' } };
    const res = makeRes();
    const next = jest.fn();

    await validateTradeBalance(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validateTrade combinator', () => {
  it('stops at the first validator that answers the request', async () => {
    const rejecting = (req, res) => {
      res.status(400).json({ success: false, code: 'NOPE' });
    };
    const shouldNotRun = jest.fn((req, res, next) => next());

    const req = { body: {} };
    const res = makeRes();
    const next = jest.fn();

    // Previously this hung: the inner promise waited only on next(), which a
    // responding validator never calls, so the chain never settled.
    await Promise.race([
      new Promise((resolve) => {
        res.once('finish', resolve);
        validateTrade(rejecting, shouldNotRun)(req, res, next);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('hung')), 1000)),
    ]);
    await new Promise((r) => setImmediate(r));

    expect(res.statusCode).toBe(400);
    expect(shouldNotRun).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('runs every validator and calls next when all pass', async () => {
    const first = jest.fn((req, res, n) => n());
    const second = jest.fn((req, res, n) => n());

    const req = { body: {} };
    const res = makeRes();
    const next = jest.fn();

    validateTrade(first, second)(req, res, next);
    await new Promise((r) => setImmediate(r));

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('forwards a validator error to next', async () => {
    const boom = new Error('boom');
    const failing = (req, res, n) => n(boom);

    const req = { body: {} };
    const res = makeRes();
    const next = jest.fn();

    validateTrade(failing)(req, res, next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(boom);
  });
});
