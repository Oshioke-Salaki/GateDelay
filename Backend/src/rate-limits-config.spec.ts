/**
 * rate-limits-config.spec.ts
 *
 * Smoke test for config/rateLimits.js — the central rate-limit rule set shared
 * by the legacy Express middleware (middleware/rateLimiter.js) and the Nest
 * rate-limiter module. It lives outside src/, so it is loaded via require().
 *
 * The goal is a boot-time sanity check: the module resolves without side
 * effects, exposes the expected sections, and its numbers are internally
 * consistent (no zero/negative windows, monotonic per-minute/hour/day tiers).
 *
 * Closes #719
 */

interface TierBudget {
  name: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  windowMs: number;
}

interface Rule {
  max: number;
  windowMs: number;
}

interface RateLimitsConfig {
  tiers: Record<string, TierBudget>;
  endpoints: Record<string, Record<string, Rule>>;
  ipLimits: Record<string, Rule>;
  whitelist: { ips: string[]; userIds: unknown[]; apiKeys: unknown[] };
  messages: Record<string, string>;
  headers: Record<string, boolean>;
  redis: { enabled: boolean; prefix: string; keyExpiration: number };
  costs: { read: number; write: number; heavy: number };
  adaptive: {
    enabled: boolean;
    loadThreshold: number;
    reductionFactor: number;
  };
}

const loadConfig = (): RateLimitsConfig =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../config/rateLimits.js') as RateLimitsConfig;

const TIER_NAMES = ['PUBLIC', 'BASIC', 'PREMIUM', 'VIP', 'ADMIN'] as const;

describe('config/rateLimits.js — module shape', () => {
  it('loads without throwing and prints nothing to the console', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => loadConfig()).not.toThrow();

    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('exposes every top-level section', () => {
    const cfg = loadConfig();
    for (const key of [
      'tiers',
      'endpoints',
      'ipLimits',
      'whitelist',
      'messages',
      'headers',
      'redis',
      'costs',
      'adaptive',
    ]) {
      expect(cfg).toHaveProperty(key);
    }
  });
});

describe('config/rateLimits.js — tiers', () => {
  it('defines all five subscription tiers', () => {
    const { tiers } = loadConfig();
    expect(Object.keys(tiers).sort()).toEqual([...TIER_NAMES].sort());
  });

  it.each(TIER_NAMES)('tier %s has positive, monotonic limits', (name) => {
    const tier = loadConfig().tiers[name];

    expect(typeof tier.name).toBe('string');
    const numericFields: (keyof TierBudget)[] = [
      'requestsPerMinute',
      'requestsPerHour',
      'requestsPerDay',
      'burstLimit',
      'windowMs',
    ];
    for (const field of numericFields) {
      expect(typeof tier[field]).toBe('number');
      expect(tier[field] as number).toBeGreaterThan(0);
    }

    expect(tier.requestsPerMinute).toBeLessThanOrEqual(tier.requestsPerHour);
    expect(tier.requestsPerHour).toBeLessThanOrEqual(tier.requestsPerDay);
    expect(tier.burstLimit).toBeLessThanOrEqual(tier.requestsPerMinute);
  });
});

describe('config/rateLimits.js — endpoints', () => {
  it('gives every endpoint a limit for every tier', () => {
    const { endpoints } = loadConfig();
    const endpointNames = Object.keys(endpoints);
    expect(endpointNames.length).toBeGreaterThan(0);

    for (const endpoint of endpointNames) {
      for (const tier of TIER_NAMES) {
        const rule = endpoints[endpoint][tier];
        expect(rule).toBeDefined();
        expect(rule.max).toBeGreaterThan(0);
        expect(rule.windowMs).toBeGreaterThan(0);
      }
    }
  });
});

describe('config/rateLimits.js — ipLimits, costs, adaptive', () => {
  it('IP limits are positive', () => {
    const { ipLimits } = loadConfig();
    for (const bucket of ['global', 'strict']) {
      expect(ipLimits[bucket].max).toBeGreaterThan(0);
      expect(ipLimits[bucket].windowMs).toBeGreaterThan(0);
    }
  });

  it('operation costs increase from read to write to heavy', () => {
    const { costs } = loadConfig();
    expect(costs.read).toBeLessThan(costs.write);
    expect(costs.write).toBeLessThan(costs.heavy);
  });

  it('adaptive thresholds sit in the (0, 1] range', () => {
    const { adaptive } = loadConfig();
    expect(typeof adaptive.enabled).toBe('boolean');
    expect(adaptive.loadThreshold).toBeGreaterThan(0);
    expect(adaptive.loadThreshold).toBeLessThanOrEqual(1);
    expect(adaptive.reductionFactor).toBeGreaterThan(0);
    expect(adaptive.reductionFactor).toBeLessThanOrEqual(1);
  });
});

describe('config/rateLimits.js — whitelist env wiring', () => {
  const original = process.env.RATE_LIMIT_WHITELIST;

  afterEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_WHITELIST;
    else process.env.RATE_LIMIT_WHITELIST = original;
    jest.resetModules();
  });

  it('defaults to an empty IP list when RATE_LIMIT_WHITELIST is unset', () => {
    delete process.env.RATE_LIMIT_WHITELIST;
    jest.resetModules();
    expect(loadConfig().whitelist.ips).toEqual([]);
  });

  it('parses RATE_LIMIT_WHITELIST as a comma-separated IP list', () => {
    process.env.RATE_LIMIT_WHITELIST = '10.0.0.1,10.0.0.2';
    jest.resetModules();
    expect(loadConfig().whitelist.ips).toEqual(['10.0.0.1', '10.0.0.2']);
  });
});
