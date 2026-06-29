const Redis = require('ioredis');
const _ = require('lodash');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

const FEATURE_FLAGS_KEY = 'feature_flags';
const FLAG_USAGE_KEY = 'flag_usage';

class FeatureFlagService {
  constructor() {
    this.flags = new Map();
    this.segments = new Map();
  }

  async initialize() {
    try {
      const cachedFlags = await redis.get(FEATURE_FLAGS_KEY);
      if (cachedFlags) {
        const flags = JSON.parse(cachedFlags);
        for (const [key, value] of Object.entries(flags)) {
          this.flags.set(key, value);
        }
      }
    } catch (error) {
      console.error('Failed to initialize feature flags from cache:', error);
    }
  }

  async createFlag(flagKey, config) {
    const flag = {
      key: flagKey,
      name: config.name || flagKey,
      description: config.description || '',
      enabled: config.enabled || false,
      rolloutPercentage: config.rolloutPercentage || 0,
      segments: config.segments || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flagKey, flag);
    await this.cacheFlags();

    return flag;
  }

  async updateFlag(flagKey, updates) {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      throw new Error(`Flag ${flagKey} not found`);
    }

    const updatedFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date()
    };

    this.flags.set(flagKey, updatedFlag);
    await this.cacheFlags();

    return updatedFlag;
  }

  async deleteFlag(flagKey) {
    const deleted = this.flags.delete(flagKey);
    if (deleted) {
      await this.cacheFlags();
    }
    return deleted;
  }

  getFlag(flagKey) {
    return this.flags.get(flagKey);
  }

  getAllFlags() {
    return Array.from(this.flags.values());
  }

  async toggleFlag(flagKey, enabled) {
    return this.updateFlag(flagKey, { enabled });
  }

  async setRolloutPercentage(flagKey, percentage) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    return this.updateFlag(flagKey, { rolloutPercentage: percentage });
  }

  isFlagEnabled(flagKey, user = {}) {
    const flag = this.flags.get(flagKey);
    if (!flag || !flag.enabled) {
      return false;
    }

    if (flag.segments && flag.segments.length > 0) {
      const userSegment = this.getUserSegment(user);
      if (!flag.segments.includes(userSegment)) {
        return false;
      }
    }

    if (flag.rolloutPercentage < 100) {
      const hash = this.hashUserForRollout(user);
      return (hash % 100) < flag.rolloutPercentage;
    }

    return true;
  }

  hashUserForRollout(user) {
    const userId = user.id || user.email || user.ip || 'anonymous';
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  defineSegment(segmentKey, config) {
    this.segments.set(segmentKey, {
      key: segmentKey,
      name: config.name || segmentKey,
      criteria: config.criteria || {},
      createdAt: new Date()
    });
  }

  getUserSegment(user) {
    for (const [key, segment] of this.segments) {
      if (this.matchesSegment(user, segment.criteria)) {
        return key;
      }
    }
    return 'default';
  }

  matchesSegment(user, criteria) {
    return _.matches(criteria)(user);
  }

  async trackFlagUsage(flagKey, user, action = 'accessed') {
    const usage = {
      flagKey,
      userId: user.id || 'anonymous',
      action,
      timestamp: new Date(),
      metadata: {
        segment: this.getUserSegment(user)
      }
    };

    await redis.lpush(FLAG_USAGE_KEY, JSON.stringify(usage));
    await redis.ltrim(FLAG_USAGE_KEY, 0, 9999);
  }

  async getFlagUsageMetrics(flagKey, timeRange = '24h') {
    const usages = await redis.lrange(FLAG_USAGE_KEY, 0, -1);
    const parsedUsages = usages.map(u => JSON.parse(u));

    const now = new Date();
    const startTime = new Date(now - this.parseTimeRange(timeRange));

    const filteredUsages = parsedUsages.filter(u => {
      return u.flagKey === flagKey && new Date(u.timestamp) >= startTime;
    });

    const metrics = {
      flagKey,
      timeRange,
      totalAccess: filteredUsages.length,
      uniqueUsers: new Set(filteredUsages.map(u => u.userId)).size,
      bySegment: {},
      timeline: []
    };

    filteredUsages.forEach(u => {
      if (!metrics.bySegment[u.metadata.segment]) {
        metrics.bySegment[u.metadata.segment] = 0;
      }
      metrics.bySegment[u.metadata.segment]++;
    });

    const hourlyBuckets = {};
    filteredUsages.forEach(u => {
      const hour = new Date(u.timestamp).toISOString().slice(0, 13);
      if (!hourlyBuckets[hour]) {
        hourlyBuckets[hour] = 0;
      }
      hourlyBuckets[hour]++;
    });

    metrics.timeline = Object.entries(hourlyBuckets)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return metrics;
  }

  parseTimeRange(range) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ranges[range] || ranges['24h'];
  }

  async cacheFlags() {
    const flagsObj = Object.fromEntries(this.flags);
    await redis.set(FEATURE_FLAGS_KEY, JSON.stringify(flagsObj));
  }

  async getConfiguration() {
    return {
      flags: this.getAllFlags(),
      segments: Array.from(this.segments.values())
    };
  }

  async updateConfiguration(config) {
    if (config.flags) {
      for (const flag of config.flags) {
        this.flags.set(flag.key, flag);
      }
    }

    if (config.segments) {
      for (const segment of config.segments) {
        this.segments.set(segment.key, segment);
      }
    }

    await this.cacheFlags();
    return this.getConfiguration();
  }
}

module.exports = new FeatureFlagService();
