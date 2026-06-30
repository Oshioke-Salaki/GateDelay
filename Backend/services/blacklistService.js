const redis = require('redis');

class BlacklistService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.prefix = 'blacklist:';
  }

  async addToBlacklist(identifier, reason, expiryDays = null) {
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
