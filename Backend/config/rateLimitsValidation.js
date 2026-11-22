/**
 * rateLimitsValidation.js — Startup validation for config/rateLimits.js.
 *
 * The rate-limit tables in config/rateLimits.js are pure data, so nothing
 * checked them: a typo'd window, a tier missing an endpoint rule, or a Redis
 * prefix left empty all boot cleanly and only surface later as a limiter that
 * silently does nothing — or, worse, one that falls back to a per-process
 * counter and lets a single instance be flooded while production traffic is
 * spread over several.
 *
 * `validateRateLimits` is a pure function over a config object so it can be
 * exercised without touching process.env, and `assertValidRateLimits` is the
 * boot-time wrapper that turns the findings into a single thrown error before
 * the server starts accepting traffic.
 *
 * Closes #911
 */

'use strict';

const REQUIRED_SECTIONS = [
  'tiers',
  'endpoints',
  'ipLimits',
  'whitelist',
  'messages',
  'headers',
  'redis',
  'costs',
  'adaptive',
];

const TIER_NUMERIC_FIELDS = [
  'requestsPerMinute',
  'requestsPerHour',
  'requestsPerDay',
  'burstLimit',
  'windowMs',
];

// A window below one second is almost always a unit mistake (ms vs s), and it
// lets a client burn a whole bucket inside a single event-loop tick.
const MIN_WINDOW_MS = 1000;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV4_CIDR = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/;
const IPV6_CIDR = /^[0-9a-f:]+::\/?\d{0,2}$/i;

// Whitelisting these disables the limiter for the whole internet.
const OPEN_CIDRS = new Set(['0.0.0.0/0', '::/0', '*']);

class RateLimitConfigError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'RateLimitConfigError';
    this.report = report;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidIpEntry(entry) {
  if (typeof entry !== 'string' || entry.trim() === '') return false;
  const value = entry.trim();

  const cidrMatch = IPV4_CIDR.exec(value);
  if (cidrMatch) {
    if (Number(cidrMatch[2]) > 32) return false;
    return isValidIpv4(cidrMatch[1]);
  }
  if (IPV6_CIDR.test(value)) return true;

  return isValidIpv4(value);
}

function isValidIpv4(value) {
  const match = IPV4.exec(value);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) <= 255);
}

/** Longest window any rule relies on, in milliseconds. */
function collectMaxWindowMs(config) {
  let max = 0;

  for (const tier of Object.values(config.tiers || {})) {
    if (isPlainObject(tier) && isPositiveNumber(tier.windowMs)) {
      max = Math.max(max, tier.windowMs);
    }
  }
  for (const rules of Object.values(config.endpoints || {})) {
    if (!isPlainObject(rules)) continue;
    for (const rule of Object.values(rules)) {
      if (isPlainObject(rule) && isPositiveNumber(rule.windowMs)) {
        max = Math.max(max, rule.windowMs);
      }
    }
  }
  for (const rule of Object.values(config.ipLimits || {})) {
    if (isPlainObject(rule) && isPositiveNumber(rule.windowMs)) {
      max = Math.max(max, rule.windowMs);
    }
  }

  return max;
}

function redisIsConfigured(env) {
  if (typeof env.REDIS_URL === 'string' && env.REDIS_URL.trim() !== '') {
    return true;
  }
  return typeof env.REDIS_HOST === 'string' && env.REDIS_HOST.trim() !== '';
}

/**
 * Validate a rate-limit configuration.
 *
 * @param {object} config  - the config/rateLimits.js export
 * @param {object} [options]
 * @param {string} [options.nodeEnv] - defaults to process.env.NODE_ENV
 * @param {NodeJS.ProcessEnv} [options.env] - defaults to process.env
 * @returns {{ valid: boolean, errors: string[], warnings: string[], production: boolean }}
 */
function validateRateLimits(config, options = {}) {
  const env = options.env || process.env;
  const nodeEnv = options.nodeEnv || env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';

  const errors = [];
  const warnings = [];
  const ctx = {
    production,
    // A bad shape is always fatal; a bad *value* is fatal in production and
    // only reported in development so local iteration is not blocked by a
    // placeholder limit.
    fail: (message) => (production ? errors : warnings).push(message),
    warn: (message) => warnings.push(message),
    error: (message) => errors.push(message),
  };

  if (!isPlainObject(config)) {
    return {
      valid: false,
      production,
      errors: ['[rate-limits] configuration export is not an object.'],
      warnings,
    };
  }

  for (const section of REQUIRED_SECTIONS) {
    if (config[section] === undefined || config[section] === null) {
      errors.push(`[rate-limits] missing required section "${section}".`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, production, errors, warnings };
  }

  validateTiers(config, ctx);
  validateEndpoints(config, ctx);
  validateIpLimits(config, ctx);
  validateWhitelist(config, ctx);
  validateMessages(config, ctx);
  validateHeaders(config, ctx);
  validateCosts(config, ctx);
  validateAdaptive(config, ctx);
  validateRedis(config, env, ctx);

  return { valid: errors.length === 0, production, errors, warnings };
}

function validateTiers(config, ctx) {
  const { fail, warn, error } = ctx;
  const tiers = config.tiers;
  if (!isPlainObject(tiers) || Object.keys(tiers).length === 0) {
    error('[rate-limits] "tiers" must define at least one tier.');
    return;
  }

  for (const [tierName, tier] of Object.entries(tiers)) {
    const where = `tiers.${tierName}`;
    if (!isPlainObject(tier)) {
      errors.push(`[rate-limits] ${where} must be an object.`);
      continue;
    }
    if (typeof tier.name !== 'string' || tier.name.trim() === '') {
      fail(`[rate-limits] ${where}.name must be a non-empty string.`);
    }
    for (const field of TIER_NUMERIC_FIELDS) {
      if (!isPositiveNumber(tier[field])) {
        fail(`[rate-limits] ${where}.${field} must be a positive number.`);
      }
    }

    if (tier.windowMs !== undefined && tier.windowMs < MIN_WINDOW_MS) {
      fail(
        `[rate-limits] ${where}.windowMs is ${tier.windowMs}ms; windows shorter than ${MIN_WINDOW_MS}ms are treated as a configuration mistake.`,
      );
    }
    if (
      isPositiveNumber(tier.requestsPerMinute) &&
      isPositiveNumber(tier.requestsPerHour) &&
      tier.requestsPerMinute > tier.requestsPerHour
    ) {
      fail(
        `[rate-limits] ${where} allows ${tier.requestsPerMinute}/min but only ${tier.requestsPerHour}/hour; the hourly budget is unreachable.`,
      );
    }
    if (
      isPositiveNumber(tier.requestsPerHour) &&
      isPositiveNumber(tier.requestsPerDay) &&
      tier.requestsPerHour > tier.requestsPerDay
    ) {
      fail(
        `[rate-limits] ${where} allows ${tier.requestsPerHour}/hour but only ${tier.requestsPerDay}/day; the daily budget is unreachable.`,
      );
    }
    if (
      isPositiveNumber(tier.burstLimit) &&
      isPositiveNumber(tier.requestsPerMinute) &&
      tier.burstLimit > tier.requestsPerMinute
    ) {
      warn(
        `[rate-limits] ${where}.burstLimit (${tier.burstLimit}) exceeds requestsPerMinute (${tier.requestsPerMinute}); the burst allowance can never be used.`,
      );
    }
  }
}

function validateEndpoints(config, ctx) {
  const { fail, error } = ctx;
  const endpoints = config.endpoints;
  const tierNames = Object.keys(config.tiers || {});

  if (!isPlainObject(endpoints) || Object.keys(endpoints).length === 0) {
    error('[rate-limits] "endpoints" must define at least one endpoint.');
    return;
  }

  for (const [endpoint, rules] of Object.entries(endpoints)) {
    if (!isPlainObject(rules)) {
      error(`[rate-limits] endpoints.${endpoint} must be an object.`);
      continue;
    }
    for (const tierName of tierNames) {
      const rule = rules[tierName];
      if (!isPlainObject(rule)) {
        fail(
          `[rate-limits] endpoints.${endpoint} has no rule for tier "${tierName}".`,
        );
        continue;
      }
      if (!isPositiveNumber(rule.max)) {
        fail(
          `[rate-limits] endpoints.${endpoint}.${tierName}.max must be a positive number.`,
        );
      }
      if (!isPositiveNumber(rule.windowMs)) {
        fail(
          `[rate-limits] endpoints.${endpoint}.${tierName}.windowMs must be a positive number.`,
        );
      } else if (rule.windowMs < MIN_WINDOW_MS) {
        fail(
          `[rate-limits] endpoints.${endpoint}.${tierName}.windowMs is ${rule.windowMs}ms; windows shorter than ${MIN_WINDOW_MS}ms are treated as a configuration mistake.`,
        );
      }
    }
  }
}

function validateIpLimits(config, ctx) {
  const { fail, warn, error } = ctx;
  const ipLimits = config.ipLimits;
  if (!isPlainObject(ipLimits)) {
    error('[rate-limits] "ipLimits" must be an object.');
    return;
  }

  for (const bucket of ['global', 'strict']) {
    const rule = ipLimits[bucket];
    if (!isPlainObject(rule)) {
      error(`[rate-limits] ipLimits.${bucket} must be an object.`);
      continue;
    }
    if (!isPositiveNumber(rule.max)) {
      fail(`[rate-limits] ipLimits.${bucket}.max must be a positive number.`);
    }
    if (!isPositiveNumber(rule.windowMs)) {
      fail(
        `[rate-limits] ipLimits.${bucket}.windowMs must be a positive number.`,
      );
    } else if (rule.windowMs < MIN_WINDOW_MS) {
      fail(
        `[rate-limits] ipLimits.${bucket}.windowMs is ${rule.windowMs}ms; windows shorter than ${MIN_WINDOW_MS}ms are treated as a configuration mistake.`,
      );
    }
  }

  if (
    isPositiveNumber(ipLimits.strict?.max) &&
    isPositiveNumber(ipLimits.global?.max) &&
    ipLimits.strict.max > ipLimits.global.max
  ) {
    warn(
      `[rate-limits] ipLimits.strict.max (${ipLimits.strict.max}) is looser than ipLimits.global.max (${ipLimits.global.max}); the "strict" bucket is not actually strict.`,
    );
  }
}

function validateWhitelist(config, ctx) {
  const { fail, warn, error, production } = ctx;
  const whitelist = config.whitelist;
  if (!isPlainObject(whitelist)) {
    error('[rate-limits] "whitelist" must be an object.');
    return;
  }
  if (!Array.isArray(whitelist.ips)) {
    error('[rate-limits] whitelist.ips must be an array.');
    return;
  }

  for (const entry of whitelist.ips) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      fail('[rate-limits] whitelist.ips contains an empty entry.');
      continue;
    }
    const value = entry.trim();
    if (OPEN_CIDRS.has(value) || OPEN_CIDRS.has(value.toLowerCase())) {
      fail(
        `[rate-limits] whitelist.ips contains "${value}", which exempts every client from rate limiting.`,
      );
      continue;
    }
    if (!isValidIpEntry(value)) {
      fail(
        `[rate-limits] whitelist.ips contains "${value}", which is not a valid IP address or CIDR block.`,
      );
      continue;
    }
    if (
      production &&
      !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value)
    ) {
      warn(
        `[rate-limits] whitelist.ips exempts public address "${value}" from rate limiting in production.`,
      );
    }
  }
}

function validateMessages(config, ctx) {
  const { fail, error } = ctx;
  const messages = config.messages;
  if (!isPlainObject(messages)) {
    error('[rate-limits] "messages" must be an object.');
    return;
  }
  if (
    typeof messages.exceeded !== 'string' ||
    messages.exceeded.trim() === ''
  ) {
    fail('[rate-limits] messages.exceeded must be a non-empty string.');
  }
}

function validateHeaders(config, ctx) {
  const { fail, warn, error } = ctx;
  const headers = config.headers;
  if (!isPlainObject(headers)) {
    error('[rate-limits] "headers" must be an object.');
    return;
  }
  for (const flag of ['standard', 'legacy', 'includeReset']) {
    if (headers[flag] !== undefined && typeof headers[flag] !== 'boolean') {
      fail(`[rate-limits] headers.${flag} must be a boolean.`);
    }
  }
  if (headers.standard !== true && headers.legacy !== true) {
    fail(
      '[rate-limits] headers.standard and headers.legacy are both false; clients will receive no rate-limit headers at all.',
    );
  }
  if (headers.includeReset === true && headers.standard !== true) {
    warn(
      '[rate-limits] headers.includeReset is set but standard headers are disabled; the reset time has nowhere to go.',
    );
  }
}

function validateCosts(config, ctx) {
  const { fail, error } = ctx;
  const costs = config.costs;
  if (!isPlainObject(costs)) {
    error('[rate-limits] "costs" must be an object.');
    return;
  }
  for (const operation of ['read', 'write', 'heavy']) {
    if (!isPositiveNumber(costs[operation])) {
      fail(`[rate-limits] costs.${operation} must be a positive number.`);
    }
  }
  if (
    isPositiveNumber(costs.read) &&
    isPositiveNumber(costs.write) &&
    isPositiveNumber(costs.heavy) &&
    !(costs.read <= costs.write && costs.write <= costs.heavy)
  ) {
    fail(
      `[rate-limits] costs must increase in cost: read (${costs.read}) <= write (${costs.write}) <= heavy (${costs.heavy}).`,
    );
  }
}

function validateAdaptive(config, ctx) {
  const { fail, error } = ctx;
  const adaptive = config.adaptive;
  if (!isPlainObject(adaptive)) {
    error('[rate-limits] "adaptive" must be an object.');
    return;
  }
  if (typeof adaptive.enabled !== 'boolean') {
    fail('[rate-limits] adaptive.enabled must be a boolean.');
  }
  if (!isPositiveNumber(adaptive.loadThreshold) || adaptive.loadThreshold > 1) {
    fail('[rate-limits] adaptive.loadThreshold must be within (0, 1].');
  }
  if (
    !isPositiveNumber(adaptive.reductionFactor) ||
    adaptive.reductionFactor > 1
  ) {
    fail('[rate-limits] adaptive.reductionFactor must be within (0, 1].');
  }
}

function validateRedis(config, env, ctx) {
  const { fail, warn, error } = ctx;
  const redis = config.redis;
  if (!isPlainObject(redis)) {
    error('[rate-limits] "redis" must be an object.');
    return;
  }
  if (typeof redis.enabled !== 'boolean') {
    error('[rate-limits] redis.enabled must be a boolean.');
  }
  if (typeof redis.prefix !== 'string' || redis.prefix.trim() === '') {
    fail(
      "[rate-limits] redis.prefix must be a non-empty string; an empty prefix writes rate-limit keys into the caller's keyspace.",
    );
  }
  if (!isPositiveNumber(redis.keyExpiration)) {
    fail(
      '[rate-limits] redis.keyExpiration must be a positive number of seconds.',
    );
  }

  if (redis.enabled === false) {
    warn(
      '[rate-limits] redis.enabled is false; rate-limit counters are per-process and each instance enforces the full budget independently.',
    );
    return;
  }

  if (!redisIsConfigured(env)) {
    fail(
      '[rate-limits] redis.enabled is true but no Redis connection is configured; set REDIS_URL (or REDIS_HOST and REDIS_PORT) so limits are shared across instances.',
    );
  }

  if (isPositiveNumber(redis.keyExpiration)) {
    const maxWindowMs = collectMaxWindowMs(config);
    if (maxWindowMs > redis.keyExpiration * 1000) {
      fail(
        `[rate-limits] redis.keyExpiration is ${redis.keyExpiration}s but the longest window is ${maxWindowMs}ms; counters expire before the window ends and the limit never trips.`,
      );
    }
  }
}

/**
 * Validate and throw when the configuration would be unsafe to serve traffic
 * with. Returns the report on success so callers can log the warnings.
 *
 * @param {object} config
 * @param {object} [options]
 * @returns {{ valid: boolean, errors: string[], warnings: string[], production: boolean }}
 */
function assertValidRateLimits(config, options = {}) {
  const report = validateRateLimits(config, options);

  if (!report.valid) {
    throw new RateLimitConfigError(
      '[rate-limits] Rate-limit configuration is invalid:\n  - ' +
        report.errors.join('\n  - '),
      report,
    );
  }

  return report;
}

module.exports = {
  MIN_WINDOW_MS,
  OPEN_CIDRS,
  REQUIRED_SECTIONS,
  RateLimitConfigError,
  assertValidRateLimits,
  isValidIpEntry,
  validateRateLimits,
};
