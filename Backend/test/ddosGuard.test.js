const { ddosGuard, strictDDoSGuard } = require('../middleware/ddosGuard');

jest.mock('../services/ddosProtection', () => ({
  isBlacklisted: jest.fn().mockResolvedValue({ blacklisted: false }),
  trackRequest: jest.fn().mockResolvedValue({}),
  detectAttack: jest.fn().mockResolvedValue({
    isAttack: false,
    isSuspicious: false,
    severity: 0,
    patterns: [],
    metrics: { rpm: 0, rps: 0 },
  }),
  mitigate: jest.fn().mockResolvedValue({ actions: [] }),
  config: { requestsPerMinute: 1000 },
}));

const ddosProtection = require('../services/ddosProtection');

function fakeReq(overrides = {}) {
  return {
    headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'test', ...overrides.headers },
    path: '/test',
    method: 'GET',
    connection: {},
    socket: {},
    ...overrides,
  };
}

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

describe('ddosGuard middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next() for whitelisted IPs', async () => {
    const middleware = ddosGuard({ whitelist: ['1.2.3.4'] });
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(ddosProtection.isBlacklisted).not.toHaveBeenCalled();
  });

  it('returns 429 when IP is blacklisted', async () => {
    ddosProtection.isBlacklisted.mockResolvedValueOnce({
      blacklisted: true,
      reason: 'attack',
      expiresIn: 300,
    });

    const middleware = ddosGuard();
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(next).not.toHaveBeenCalled();
  });

  it('tracks request and sets rate-limit headers', async () => {
    const middleware = ddosGuard();
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(ddosProtection.trackRequest).toHaveBeenCalledWith('1.2.3.4', expect.objectContaining({
      endpoint: '/test',
      method: 'GET',
    }));
    expect(res.headers['X-RateLimit-Limit']).toBe(1000);
    expect(next).toHaveBeenCalled();
  });

  it('blocks on attack when blockOnAttack is true', async () => {
    ddosProtection.detectAttack.mockResolvedValueOnce({
      isAttack: true,
      isSuspicious: false,
      severity: 0.95,
      patterns: [{ type: 'rapid_fire', name: 'Rapid Fire', severity: 0.95 }],
      metrics: { rpm: 500, rps: 200 },
    });

    const middleware = ddosGuard({ blockOnAttack: true });
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('DDOS_DETECTED');
    expect(next).not.toHaveBeenCalled();
  });

  it('fails open on middleware error', async () => {
    ddosProtection.isBlacklisted.mockRejectedValueOnce(new Error('Redis down'));

    const middleware = ddosGuard();
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('strictDDoSGuard', () => {
  it('returns middleware with aggressive defaults', async () => {
    const middleware = strictDDoSGuard();
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('ddosGuard health check', () => {
  it('exposes healthCheck that validates underlying service', async () => {
    const { healthCheck } = require('../middleware/ddosGuard');
    const status = await healthCheck();
    expect(status).toBe(true);
  });

  it('healthCheck returns false when service is unreachable', async () => {
    ddosProtection.isBlacklisted.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { healthCheck } = require('../middleware/ddosGuard');
    const status = await healthCheck();
    expect(status).toBe(false);
  });
});
