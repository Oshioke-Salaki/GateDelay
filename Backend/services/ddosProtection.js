const Redis = require('ioredis');

/**
 * DDOS PROTECTION SERVICE
 * Detects and mitigates distributed denial-of-service attacks
 * Uses Redis for distributed rate tracking and IP reputation scoring
 */

class DDoSProtectionService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DDOS_DB || 5,
    });

    // Configuration
    this.config = {
      // Request thresholds
      requestsPerSecond: 100,
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      
      // Attack detection
      suspiciousThreshold: 0.7, // Score threshold for suspicious activity
      attackThreshold: 0.9, // Score threshold for confirmed attack
      
      // Blacklist duration
      blacklistDuration: 3600, // 1 hour in seconds
      tempBlockDuration: 300, // 5 minutes
      
      // Pattern detection
      patternWindow: 60, // seconds
      minPatternRequests: 50,
    };

    // Attack patterns database
    this.attackPatterns = new Map();
    this.initializePatterns();
  }

  /**
   * Initialize known attack patterns
   */
  initializePatterns() {
    this.attackPatterns.set('rapid_fire', {
      name: 'Rapid Fire Attack',
      detector: (metrics) => metrics.rps > this.config.requestsPerSecond * 2,
      severity: 0.8,
    });

    this.attackPatterns.set('slowloris', {
      name: 'Slowloris Attack',
      detector: (metrics) => metrics.connectionTime > 30000 && metrics.bodySize < 100,
      severity: 0.9,
    });

    this.attackPatterns.set('http_flood', {
      name: 'HTTP Flood',
      detector: (metrics) => metrics.rpm > this.config.requestsPerMinute * 1.5,
      severity: 0.85,
    });

    this.attackPatterns.set('distributed', {
      name: 'Distributed Attack',
      detector: (metrics) => metrics.uniqueIPs > 100 && metrics.avgRequestsPerIP > 50,
      severity: 0.95,
    });
  }

  /**
   * Track request from IP
   * @param {string} ip - Client IP address
   * @param {object} metadata - Request metadata
   * @returns {Promise<object>} Tracking result
   */
  async trackRequest(ip, metadata = {}) {
    const now = Date.now();
    const keys = {
      second: `ddos:ip:${ip}:s:${Math.floor(now / 1000)}`,
      minute: `ddos:ip:${ip}:m:${Math.floor(now / 60000)}`,
      hour: `ddos:ip:${ip}:h:${Math.floor(now / 3600000)}`,
      reputation: `ddos:rep:${ip}`,
    };

    // Increment counters
    const pipeline = this.redis.pipeline();
    pipeline.incr(keys.second);
    pipeline.expire(keys.second, 2);
    pipeline.incr(keys.minute);
    pipeline.expire(keys.minute, 120);
    pipeline.incr(keys.hour);
    pipeline.expire(keys.hour, 7200);
    
    // Store metadata
    if (metadata.endpoint) {
      pipeline.hincrby(`ddos:endpoints:${Math.floor(now / 60000)}`, metadata.endpoint, 1);
    }

    const results = await pipeline.exec();
    
    const counts = {
      perSecond: results[0][1],
      perMinute: results[2][1],
      perHour: results[4][1],
    };

    return {
      ip,
      counts,
      timestamp: now,
    };
  }

  /**
   * Detect attack patterns
   * @param {string} ip - Client IP
   * @returns {Promise<object>} Detection result
   */
  async detectAttack(ip) {
    const metrics = await this.getIPMetrics(ip);
    const detectedPatterns = [];
    let maxSeverity = 0;

    // Check each pattern
    for (const [key, pattern] of this.attackPatterns) {
      if (pattern.detector(metrics)) {
        detectedPatterns.push({
          type: key,
          name: pattern.name,
          severity: pattern.severity,
        });
        maxSeverity = Math.max(maxSeverity, pattern.severity);
      }
    }

    const isAttack = maxSeverity >= this.config.attackThreshold;
    const isSuspicious = maxSeverity >= this.config.suspiciousThreshold;

    // Update reputation score
    if (isAttack || isSuspicious) {
      await this.updateReputationScore(ip, maxSeverity);
    }

    return {
      ip,
      isAttack,
      isSuspicious,
      severity: maxSeverity,
      patterns: detectedPatterns,
      metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Get IP metrics for analysis
   * @param {string} ip - Client IP
   * @returns {Promise<object>} Metrics
   */
  async getIPMetrics(ip) {
    const now = Date.now();
    const keys = {
      second: `ddos:ip:${ip}:s:${Math.floor(now / 1000)}`,
      minute: `ddos:ip:${ip}:m:${Math.floor(now / 60000)}`,
      hour: `ddos:ip:${ip}:h:${Math.floor(now / 3600000)}`,
      reputation: `ddos:rep:${ip}`,
    };

    const [rps, rpm, rph, reputation] = await Promise.all([
      this.redis.get(keys.second).then(v => parseInt(v) || 0),
      this.redis.get(keys.minute).then(v => parseInt(v) || 0),
      this.redis.get(keys.hour).then(v => parseInt(v) || 0),
      this.redis.get(keys.reputation).then(v => parseFloat(v) || 0),
    ]);

    return {
      rps,
      rpm,
      rph,
      reputation,
      uniqueIPs: await this.getActiveIPCount(),
      avgRequestsPerIP: rpm / Math.max(await this.getActiveIPCount(), 1),
    };
  }

  /**
   * Get count of active IPs in current minute
   * @returns {Promise<number>}
   */
  async getActiveIPCount() {
    const now = Math.floor(Date.now() / 60000);
    const key = `ddos:active:${now}`;
    return parseInt(await this.redis.scard(key) || 1);
  }

  /**
   * Update IP reputation score
   * @param {string} ip - Client IP
   * @param {number} severity - Attack severity
   */
  async updateReputationScore(ip, severity) {
    const key = `ddos:rep:${ip}`;
    const current = parseFloat(await this.redis.get(key) || '0');
    const updated = Math.min(1, current + severity * 0.1);
    
    await this.redis.setex(key, 3600, updated.toString());
  }

  /**
   * Blacklist an IP address
   * @param {string} ip - IP to blacklist
   * @param {number} duration - Duration in seconds
   * @param {string} reason - Reason for blacklist
   */
  async blacklistIP(ip, duration = this.config.blacklistDuration, reason = 'DDoS attack detected') {
    const key = `ddos:blacklist:${ip}`;
    await this.redis.setex(key, duration, JSON.stringify({
      reason,
      timestamp: Date.now(),
      duration,
    }));

    // Log to attack log
    await this.logAttack(ip, reason);
  }

  /**
   * Check if IP is blacklisted
   * @param {string} ip - IP to check
   * @returns {Promise<object>} Blacklist status
   */
  async isBlacklisted(ip) {
    const key = `ddos:blacklist:${ip}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return { blacklisted: false };
    }

    const info = JSON.parse(data);
    const ttl = await this.redis.ttl(key);

    return {
      blacklisted: true,
      reason: info.reason,
      expiresIn: ttl,
      blacklistedAt: info.timestamp,
    };
  }

  /**
   * Remove IP from blacklist
   * @param {string} ip - IP to whitelist
   */
  async removeFromBlacklist(ip) {
    await this.redis.del(`ddos:blacklist:${ip}`);
    await this.redis.del(`ddos:rep:${ip}`);
  }

  /**
   * Apply mitigation strategy
   * @param {string} ip - Target IP
   * @param {object} detection - Detection result
   * @returns {Promise<object>} Mitigation result
   */
  async mitigate(ip, detection) {
    const actions = [];

    if (detection.isAttack) {
      // Blacklist for full duration
      await this.blacklistIP(ip, this.config.blacklistDuration, 
        `Attack detected: ${detection.patterns.map(p => p.name).join(', ')}`);
      actions.push('BLACKLIST');
    } else if (detection.isSuspicious) {
      // Temporary block
      await this.blacklistIP(ip, this.config.tempBlockDuration, 'Suspicious activity');
      actions.push('TEMP_BLOCK');
    }

    // Rate limiting
    if (detection.metrics.rps > this.config.requestsPerSecond) {
      actions.push('RATE_LIMIT');
    }

    return {
      ip,
      actions,
      severity: detection.severity,
      timestamp: Date.now(),
    };
  }

  /**
   * Log attack for reporting
   * @param {string} ip - Attacker IP
   * @param {string} reason - Attack reason
   */
  async logAttack(ip, reason) {
    const key = `ddos:attacks:${new Date().toISOString().split('T')[0]}`;
    await this.redis.lpush(key, JSON.stringify({
      ip,
      reason,
      timestamp: Date.now(),
    }));
    await this.redis.expire(key, 86400 * 7); // Keep for 7 days
  }

  /**
   * Generate protection report
   * @param {string} period - Report period ('day', 'week', 'month')
   * @returns {Promise<object>} Protection report
   */
  async generateReport(period = 'day') {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const reports = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const key = `ddos:attacks:${dateKey}`;
      
      const attacks = await this.redis.lrange(key, 0, -1);
      const parsed = attacks.map(a => JSON.parse(a));

      reports.push({
        date: dateKey,
        totalAttacks: parsed.length,
        uniqueIPs: new Set(parsed.map(a => a.ip)).size,
        attacks: parsed,
      });
    }

    // Aggregate statistics
    const totalAttacks = reports.reduce((sum, r) => sum + r.totalAttacks, 0);
    const allIPs = reports.flatMap(r => r.attacks.map(a => a.ip));
    const topAttackers = this.getTopAttackers(allIPs, 10);

    return {
      period,
      startDate: reports[reports.length - 1]?.date,
      endDate: reports[0]?.date,
      summary: {
        totalAttacks,
        uniqueIPs: new Set(allIPs).size,
        averagePerDay: totalAttacks / days,
        topAttackers,
      },
      daily: reports.reverse(),
      generatedAt: Date.now(),
    };
  }

  /**
   * Get top attacking IPs
   * @param {array} ips - List of IPs
   * @param {number} limit - Number of results
   * @returns {array} Top attackers
   */
  getTopAttackers(ips, limit = 10) {
    const counts = {};
    ips.forEach(ip => {
      counts[ip] = (counts[ip] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([ip, count]) => ({ ip, count }));
  }

  /**
   * Get current protection status
   * @returns {Promise<object>} Status
   */
  async getStatus() {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);
    
    const [blacklistedCount, activeIPs, todayAttacks] = await Promise.all([
      this.redis.keys('ddos:blacklist:*').then(keys => keys.length),
      this.redis.scard(`ddos:active:${minuteKey}`),
      this.redis.llen(`ddos:attacks:${new Date().toISOString().split('T')[0]}`),
    ]);

    return {
      active: true,
      timestamp: now,
      metrics: {
        blacklistedIPs: blacklistedCount,
        activeIPs: parseInt(activeIPs) || 0,
        attacksToday: todayAttacks,
      },
      config: this.config,
    };
  }
}

module.exports = new DDoSProtectionService();
