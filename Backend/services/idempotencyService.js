/**
 * idempotencyService.js — Redis-backed idempotency keys.
 *
 * A client that retries a trade placement after a timeout has no way to know
 * whether the first attempt locked a balance, filled, and settled before the
 * response was lost. Without a guard the retry opens a second position, and
 * for settlement that means paying out twice.
 *
 * The contract is the standard `Idempotency-Key` one:
 *   - the first request for a key is admitted and its result is stored;
 *   - a later request for the same key replays that stored result verbatim,
 *     without re-running the handler;
 *   - a request whose predecessor is still running is rejected as in-flight
 *     rather than executed concurrently;
 *   - a request that throws releases its key, so a genuine failure can be
 *     retried immediately.
 *
 * Keys are short-lived by design (default 24h) — long enough to cover any
 * sane client retry window, short enough that the store does not become a
 * second database.
 *
 * Redis is the source of truth so the guard holds across instances and across
 * a restart. When Redis is unreachable the store degrades to a process-local
 * map: still correct for a single instance, and the degradation is logged
 * loudly rather than silent.
 *
 * Closes #912
 */

'use strict';

const { randomUUID } = require('crypto');

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const MAX_KEY_LENGTH = 255;
const VALID_KEY = /^[A-Za-z0-9._~:@/+=-]+$/;
const MAX_MEMORY_ENTRIES = 10_000;

const STATE_PENDING = 'pending';
const STATE_COMPLETED = 'completed';

/**
 * Only the holder of the reservation token may finalise or release it. Without
 * this check a slow first attempt that already gave up would overwrite the
 * result of the retry that replaced it.
 */
const COMPLETE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local ok, decoded = pcall(cjson.decode, current)
if not ok then return 0 end
if decoded.token ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

const RELEASE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local ok, decoded = pcall(cjson.decode, current)
if not ok then return 0 end
if decoded.token ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`;

class IdempotencyError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function buildKey(scope, key) {
  return `idem:${scope}:${key}`;
}

/**
 * Validate a client-supplied key. Keys end up in Redis key names, so anything
 * outside a conservative charset is rejected rather than escaped.
 */
function normalizeKey(raw) {
  if (Array.isArray(raw)) {
    raw = raw[0];
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new IdempotencyError(
      'Idempotency key must be a non-empty string.',
      'INVALID_IDEMPOTENCY_KEY',
      400,
    );
  }
  const key = raw.trim();
  if (key.length > MAX_KEY_LENGTH) {
    throw new IdempotencyError(
      `Idempotency key must be at most ${MAX_KEY_LENGTH} characters.`,
      'INVALID_IDEMPOTENCY_KEY',
      400,
    );
  }
  if (!VALID_KEY.test(key)) {
    throw new IdempotencyError(
      'Idempotency key may only contain letters, digits and the characters . _ ~ : @ / + = -',
      'INVALID_IDEMPOTENCY_KEY',
      400,
    );
  }
  return key;
}

function parseTtl(raw) {
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_TTL_SECONDS;
}

/** In-process fallback used when Redis cannot be reached. */
function createMemoryBackend() {
  const entries = new Map();

  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= now) {
        entries.delete(key);
      }
    }
    // Map preserves insertion order, so the oldest keys come first.
    while (entries.size > MAX_MEMORY_ENTRIES) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  };

  return {
    name: 'memory',
    async setIfAbsent(key, value, ttlSeconds) {
      prune();
      if (entries.has(key)) {
        return false;
      }
      entries.set(key, {
        record: JSON.parse(value),
        expiresAtMs: Date.now() + ttlSeconds * 1000,
      });
      return true;
    },
    async get(key) {
      prune();
      const entry = entries.get(key);
      return entry ? entry.record : null;
    },
    async compareAndSet(key, token, value, ttlSeconds) {
      prune();
      const entry = entries.get(key);
      if (!entry || entry.record.token !== token) {
        return false;
      }
      entries.set(key, {
        record: JSON.parse(value),
        expiresAtMs: Date.now() + ttlSeconds * 1000,
      });
      return true;
    },
    async compareAndDelete(key, token) {
      prune();
      const entry = entries.get(key);
      if (!entry || entry.record.token !== token) {
        return false;
      }
      entries.delete(key);
      return true;
    },
  };
}

function createRedisBackend(redis) {
  return {
    name: 'redis',
    async setIfAbsent(key, value, ttlSeconds) {
      const result = await redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },
    async get(key) {
      const raw = await redis.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        // A key written by something else is not ours to interpret; treat it as
        // a reservation we cannot reason about and let the caller reject.
        return { state: STATE_PENDING, token: null, unreadable: true };
      }
    },
    async compareAndSet(key, token, value, ttlSeconds) {
      const result = await redis.eval(
        COMPLETE_SCRIPT,
        1,
        key,
        token,
        value,
        String(ttlSeconds),
      );
      return result === 1;
    },
    async compareAndDelete(key, token) {
      const result = await redis.eval(RELEASE_SCRIPT, 1, key, token);
      return result === 1;
    },
  };
}

/**
 * Create an idempotency store.
 *
 * @param {object}  [options]
 * @param {object}  [options.redis]      - ioredis-compatible client. When
 *   omitted a lazy client is created from REDIS_URL / REDIS_HOST / REDIS_PORT.
 * @param {number}  [options.ttlSeconds] - default reservation lifetime
 * @param {object}  [options.logger]     - `{ warn, error }` sink
 */
function createIdempotencyStore(options = {}) {
  const logger = options.logger || console;
  const defaultTtlSeconds = parseTtl(
    options.ttlSeconds ?? process.env.IDEMPOTENCY_TTL_SECONDS,
  );

  let redis = options.redis || null;
  let redisResolved = Boolean(options.redis);
  let backend = redis ? createRedisBackend(redis, logger) : null;
  let memoryBackend = null;
  let warnedUnavailable = false;

  function getMemoryBackend() {
    if (!memoryBackend) {
      memoryBackend = createMemoryBackend();
    }
    return memoryBackend;
  }

  function resolveRedis() {
    if (redisResolved) {
      return redis;
    }
    redisResolved = true;
    try {
      // Required lazily: a module-load connection would keep the process
      // alive (and spam retries) even in processes that never place a trade.
      // eslint-disable-next-line global-require
      const Redis = require('ioredis');
      redis = new Redis(
        process.env.REDIS_URL || {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          db: process.env.REDIS_DB || 0,
        },
      );
      redis.on('error', (err) => {
        logger.warn(`[idempotency] Redis error: ${err.message}`);
      });
      backend = createRedisBackend(redis);
    } catch (err) {
      redis = null;
      backend = getMemoryBackend();
      logger.error(
        `[idempotency] Redis unavailable, falling back to an in-process idempotency store: ${err.message}`,
      );
    }
    return redis;
  }

  function getBackend() {
    if (backend) {
      return backend;
    }
    resolveRedis();
    return backend || getMemoryBackend();
  }

  /**
   * Run `action` against the active backend, degrading to the shared in-process
   * store if Redis is unreachable. The fallback is a *shared* instance, not a
   * fresh one, so a degraded run still deduplicates within the process.
   */
  async function withBackend(action) {
    try {
      return await action(getBackend());
    } catch (err) {
      if (!warnedUnavailable) {
        warnedUnavailable = true;
        logger.error(
          `[idempotency] idempotency store unavailable (${err.message}); requests are no longer deduplicated across instances.`,
        );
      }
      return action(getMemoryBackend());
    }
  }

  /**
   * Claim a key.
   *
   * @returns {Promise<{acquired: true, token: string, recordKey: string}
   *                  | {acquired: false, state: 'pending'|'completed', statusCode?: number, response?: unknown}>}
   */
  async function begin(scope, rawKey, opts = {}) {
    const key = normalizeKey(rawKey);
    const recordKey = buildKey(scope, key);
    const ttlSeconds = parseTtl(opts.ttlSeconds ?? defaultTtlSeconds);
    const token = randomUUID();
    const pending = JSON.stringify({
      state: STATE_PENDING,
      token,
      scope,
      key,
      startedAt: new Date().toISOString(),
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const acquired = await withBackend((store) =>
        store.setIfAbsent(recordKey, pending, ttlSeconds),
      );
      if (acquired) {
        return { acquired: true, token, recordKey };
      }

      // eslint-disable-next-line no-await-in-loop
      const existing = await withBackend((store) => store.get(recordKey));

      if (existing === null) {
        // The holder's key expired between our SET NX and our GET. Retry the
        // claim once; if it fails again the caller sees an in-flight conflict.
        continue;
      }
      if (existing.state === STATE_COMPLETED) {
        return {
          acquired: false,
          state: STATE_COMPLETED,
          statusCode: existing.statusCode,
          response: existing.response,
        };
      }
      return { acquired: false, state: STATE_PENDING };
    }

    return { acquired: false, state: STATE_PENDING };
  }

  /** Store the result of a successful run so retries can replay it. */
  async function complete(scope, rawKey, token, result, opts = {}) {
    const key = normalizeKey(rawKey);
    const recordKey = buildKey(scope, key);
    const ttlSeconds = parseTtl(opts.ttlSeconds ?? defaultTtlSeconds);
    const payload = {
      state: STATE_COMPLETED,
      token,
      scope,
      key,
      statusCode: opts.statusCode,
      response: result,
      completedAt: new Date().toISOString(),
    };
    const value = JSON.stringify(payload);

    return withBackend((store) =>
      store.compareAndSet(recordKey, token, value, ttlSeconds),
    );
  }

  /** Release a key after a failed run so the caller may retry. */
  async function release(scope, rawKey, token) {
    const key = normalizeKey(rawKey);
    const recordKey = buildKey(scope, key);

    return withBackend((store) => store.compareAndDelete(recordKey, token));
  }

  /** Inspect a key without claiming it. Returns null when unknown. */
  async function peek(scope, rawKey) {
    const key = normalizeKey(rawKey);
    return withBackend((store) => store.get(buildKey(scope, key)));
  }

  return {
    backendName: () => getBackend().name,
    logger,
    begin,
    complete,
    release,
    peek,
  };
}

const defaultStore = createIdempotencyStore();

/**
 * Run `fn` at most once per (scope, key).
 *
 * @returns {Promise<{replayed: boolean, response?: unknown, statusCode?: number}>}
 * @throws  {IdempotencyError} 409 when an identical request is still running
 */
async function withIdempotency(scope, rawKey, fn, options = {}) {
  const claim = await defaultStore.begin(scope, rawKey, options);

  if (!claim.acquired) {
    if (claim.state === STATE_COMPLETED) {
      return {
        replayed: true,
        response: claim.response,
        statusCode: claim.statusCode,
      };
    }
    throw new IdempotencyError(
      'A request with this Idempotency-Key is still in progress.',
      'IDEMPOTENCY_IN_PROGRESS',
      409,
    );
  }

  try {
    const response = await fn();
    const stored = await defaultStore.complete(
      scope,
      rawKey,
      claim.token,
      response,
      options,
    );
    if (!stored) {
      // The reservation was lost (expired, or another writer finalised it), so
      // this result is *not* replayable and the key may sit pending until its
      // TTL. The placement itself already succeeded, so this is logged rather
      // than thrown — but it must not pass unnoticed.
      defaultStore.logger.warn(
        `[idempotency] could not store the result for ${scope}/${rawKey}; retries with this key will not replay it.`,
      );
    }
    return { replayed: false, response };
  } catch (err) {
    await defaultStore.release(scope, rawKey, claim.token);
    throw err;
  }
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  IdempotencyError,
  MAX_KEY_LENGTH,
  STATE_COMPLETED,
  STATE_PENDING,
  createIdempotencyStore,
  normalizeKey,
  withIdempotency,
  store: defaultStore,
};
