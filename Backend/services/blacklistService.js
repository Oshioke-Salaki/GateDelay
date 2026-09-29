/**
 * @file services/blacklistService.js
 * @description Redis-backed blacklist management service for GateDelay.
 *
 * ## Security review (#711)
 *
 * ### Secrets / private key policy
 *   - NO secrets or private keys are stored in this file.
 *   - The service receives a pre-constructed Redis client via constructor
 *     injection; it never reads connection credentials itself.
 *   - All Redis keys are namespaced under the `blacklist:` prefix so they
 *     cannot collide with other data stored in the same Redis instance.
 *
 * ### Beta gate check
 *   A caller may attempt to perform blacklist mutations (add, remove, batch)
 *   before the beta-access gate has been verified.  Phase 2+ callers MUST
 *   verify beta access before invoking mutation methods.  The route layer
 *   (`Backend/routes/blacklist.js`) is responsible for enforcing the auth
 *   guard; this service layer intentionally has no opinion about callers, but
 *   documents the requirement here to close the audit gap.
 *
 *   Recommended mount pattern (routes/blacklist.js):
 *     const betaAccess = require('./betaAccess');
 *     // before POST /add, /remove, /batch-add, /batch-remove:
 *     const { hasAccess } = await betaAccess.checkAccess(req.user.wallet, 'blacklist_write');
 *     if (!hasAccess) return res.status(403).json({ error: 'Beta gate: feature not enabled' });
 *
 * ### Negative-path threat notes
 *   ✓  `addToBlacklist` stores entries with an optional TTL; expired entries
 *      are lazily evicted on read (`isBlacklisted` re-checks expiry and
 *      deletes stale keys).
 *   ✓  `removeFromBlacklist` throws `'Identifier not found'` rather than
 *      silently succeeding — prevents idempotent removal from masking
 *      double-remove bugs in callers.
 *   ✓  `batchRemoveFromBlacklist` does not short-circuit on partial failure;
 *      each identifier's error is captured individually so one bad entry
 *      does not silently abort the rest of the batch.
 *   ✓  `generateReport` iterates only keys matching the `blacklist:` prefix,
 *      not the full Redis keyspace.
 *   ✗  Abuse scenario — Redis key exhaustion: an authenticated attacker could
 *      spam `addToBlacklist` with unique identifiers to fill Redis memory.
 *      Mitigation: ensure the Redis instance has a `maxmemory` policy set
 *      (e.g. `allkeys-lru`) and that the batch-add route enforces a maximum
 *      batch size (recommend ≤ 500 per request).
 *   ✗  Abuse scenario — identifier enumeration via timing: `isBlacklisted`
 *      always performs a Redis GET; the round-trip time is approximately
 *      constant regardless of whether the key exists, so timing attacks are
 *      not a practical concern here.
 *   ✗  Abuse scenario — expired-entry resurrection: if Redis is restarted
 *      without persistence and TTL-based entries are lost, those identifiers
 *      are no longer blacklisted.  Use Redis persistence (AOF or RDB) in
 *      staging and production to prevent silent unblocking on restart.
 *
 * ### Threat notes recorded inline
 *   See the constructor and individual methods below for per-operation notes.
 */

const redis = require('redis');

class BlacklistService {
  constructor(redisClient) {
    if (!redisClient) {
      // #711 — fail fast if no Redis client is provided; do not silently
      // construct a broken service instance that throws only on first use.
      throw new Error('[BlacklistService] redisClient is required');
    }
    this.redis = redisClient;
    this.prefix = 'blacklist:';
  }

  async addToBlacklist(identifier, reason, expiryDays = null) {
    // #711 — validate inputs to prevent storing empty/undefined identifiers
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new Error('identifier must be a non-empty string');
    }
    const key = `${this.prefix}${identifier}`;
    const entry = {
      identifier,
      reason,
      addedAt: new Date().toISOString(),
      expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 86400000).toISOString() : null
    };

    if (expiryDays) {
      await this.redis.setex(key, expiryDays * 86400, JSON.stringify(entry));
    } else {
      await this.redis.set(key, JSON.stringify(entry));
    }

    return entry;
  }

  async removeFromBlacklist(identifier) {
    const key = `${this.prefix}${identifier}`;
    const exists = await this.redis.exists(key);
    if (!exists) throw new Error('Identifier not found in blacklist');
    await this.redis.del(key);
    return { removed: true, identifier };
  }

  async isBlacklisted(identifier) {
    const key = `${this.prefix}${identifier}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    
    const entry = JSON.parse(data);
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      await this.redis.del(key);
      return null;
    }
    return entry;
  }

  async batchAddToBlacklist(identifiers, reason) {
    const results = [];
    for (const identifier of identifiers) {
      const result = await this.addToBlacklist(identifier, reason);
      results.push(result);
    }
    return results;
  }

  async batchRemoveFromBlacklist(identifiers) {
    const results = [];
    for (const identifier of identifiers) {
      try {
        const result = await this.removeFromBlacklist(identifier);
        results.push(result);
      } catch (error) {
        results.push({ identifier, error: error.message });
      }
    }
    return results;
  }

  async getBlacklistCount() {
    const keys = await this.redis.keys(`${this.prefix}*`);
    return keys.length;
  }

  async generateReport(startDate, endDate) {
    const keys = await this.redis.keys(`${this.prefix}*`);
    const entries = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      const entry = JSON.parse(data);
      const addedAt = new Date(entry.addedAt);

      if (addedAt >= startDate && addedAt <= endDate) {
        entries.push(entry);
      }
    }

    return {
      period: { startDate, endDate },
      totalEntries: entries.length,
      entries,
      generatedAt: new Date()
    };
  }
}

module.exports = BlacklistService;
