const Redis = require('ioredis');
const { EventEmitter } = require('events');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const DEFAULT_INTERVAL_MS = 30000;
const STALE_AFTER_MULTIPLIER = 3;
const DOWN_AFTER_MULTIPLIER = 6;

function redisKey(id) {
  return `heartbeat:component:${id}`;
}
const REGISTERED_KEY = 'heartbeat:registered';

class HeartbeatService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.redis = options.redis || new Redis({ host: REDIS_HOST, port: REDIS_PORT });
    this._local = new Map();
    this._shutdown = false;
  }

  async registerComponent(id, metadata = {}, expectedIntervalMs = DEFAULT_INTERVAL_MS) {
    if (!id || typeof id !== 'string') throw new Error('component id is required');

    const payload = {
      id,
      metadata,
      expectedIntervalMs,
      registeredAt: Date.now(),
      lastBeat: null,
      status: 'registered',
      missedBeats: 0,
    };

    await this.redis.hset(REGISTERED_KEY, id, JSON.stringify(payload));
    await this.redis.set(redisKey(id), JSON.stringify({
      lastBeat: null,
      missedBeats: 0,
      status: 'registered',
      updatedAt: Date.now(),
    }));
    this._local.set(id, payload);

    this.emit('registered', { id, metadata, expectedIntervalMs });
    return payload;
  }

  async unregisterComponent(id) {
    if (!id) throw new Error('component id is required');

    await this.redis.hdel(REGISTERED_KEY, id);
    await this.redis.del(redisKey(id));
    this._local.delete(id);

    this.emit('unregistered', { id });
    return { id, unregistered: true };
  }

  async beat(id, metadata = {}) {
    if (!id) throw new Error('component id is required');
    if (this._shutdown) throw new Error('service is shutting down');

    const now = Date.now();

    await this.redis.set(redisKey(id), JSON.stringify({
      lastBeat: now,
      missedBeats: 0,
      status: 'alive',
      updatedAt: now,
    }));

    const registered = await this.redis.hget(REGISTERED_KEY, id);
    if (registered) {
      const prev = JSON.parse(registered);
      const wasDown = prev.status === 'down' || prev.status === 'stale';
      prev.status = 'alive';
      prev.lastBeat = now;
      prev.missedBeats = 0;
      if (metadata) prev.metadata = { ...prev.metadata, ...metadata };
      await this.redis.hset(REGISTERED_KEY, id, JSON.stringify(prev));
      this._local.set(id, prev);

      if (wasDown) {
        this.emit('recovered', { id, recoveredAt: now });
      }
    }

    this.emit('beat', { id, timestamp: now });
    return { id, timestamp: now, status: 'alive' };
  }

  async checkLiveness() {
    const entries = await this.redis.hgetall(REGISTERED_KEY);
    const results = [];

    for (const [id, dataStr] of Object.entries(entries)) {
      let component;
      try {
        component = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const stateStr = await this.redis.get(redisKey(id));
      let state = stateStr ? JSON.parse(stateStr) : null;

      const now = Date.now();
      const interval = component.expectedIntervalMs || DEFAULT_INTERVAL_MS;
      const staleThreshold = interval * STALE_AFTER_MULTIPLIER;
      const downThreshold = interval * DOWN_AFTER_MULTIPLIER;

      let newStatus = component.status || 'alive';
      let missedBeats = component.missedBeats || 0;

      if (!state || !state.lastBeat) {
        newStatus = 'registered';
      } else {
        const elapsed = now - state.lastBeat;
        if (elapsed >= downThreshold) {
          newStatus = 'down';
          missedBeats = Math.max(missedBeats, Math.floor(elapsed / interval));
        } else if (elapsed >= staleThreshold) {
          newStatus = 'stale';
          missedBeats = Math.max(missedBeats, Math.floor(elapsed / interval));
        } else {
          newStatus = 'alive';
          missedBeats = 0;
        }
      }

      const changed = newStatus !== component.status;

      if (changed) {
        component.status = newStatus;
        component.missedBeats = missedBeats;
        await this.redis.hset(REGISTERED_KEY, id, JSON.stringify(component));
        this._local.set(id, component);

        if (newStatus === 'down') {
          this.emit('down', { id, missedBeats, detectedAt: now });
          this.emit('alert', {
            type: 'heartbeat_down',
            componentId: id,
            severity: 'critical',
            message: `Component ${id} is DOWN (${missedBeats} missed beats)`,
            timestamp: now,
          });
        } else if (newStatus === 'stale') {
          this.emit('stale', { id, missedBeats, detectedAt: now });
          this.emit('alert', {
            type: 'heartbeat_stale',
            componentId: id,
            severity: 'warning',
            message: `Component ${id} is stale (${missedBeats} missed beats)`,
            timestamp: now,
          });
        }
      }

      results.push({
        id,
        status: newStatus,
        lastBeat: state ? state.lastBeat : null,
        missedBeats,
        expectedIntervalMs: interval,
        metadata: component.metadata,
      });
    }

    return results;
  }

  async getStatus() {
    const entries = await this.redis.hgetall(REGISTERED_KEY);
    const statuses = [];

    for (const [id, dataStr] of Object.entries(entries)) {
      let component;
      try {
        component = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const stateStr = await this.redis.get(redisKey(id));
      let state = stateStr ? JSON.parse(stateStr) : null;

      statuses.push({
        id,
        status: component.status || 'registered',
        lastBeat: state ? state.lastBeat : null,
        missedBeats: component.missedBeats || 0,
        expectedIntervalMs: component.expectedIntervalMs || DEFAULT_INTERVAL_MS,
        metadata: component.metadata,
        registeredAt: component.registeredAt,
      });
    }

    return statuses;
  }

  async getComponentStatus(id) {
    const dataStr = await this.redis.hget(REGISTERED_KEY, id);
    if (!dataStr) return null;

    const component = JSON.parse(dataStr);
    const stateStr = await this.redis.get(redisKey(id));
    let state = stateStr ? JSON.parse(stateStr) : null;

    return {
      id,
      status: component.status || 'registered',
      lastBeat: state ? state.lastBeat : null,
      missedBeats: component.missedBeats || 0,
      expectedIntervalMs: component.expectedIntervalMs || DEFAULT_INTERVAL_MS,
      metadata: component.metadata,
      registeredAt: component.registeredAt,
    };
  }

  async getStats() {
    const entries = await this.redis.hgetall(REGISTERED_KEY);
    const count = Object.keys(entries).length;

    let alive = 0, stale = 0, down = 0, registered = 0;
    for (const dataStr of Object.values(entries)) {
      try {
        const c = JSON.parse(dataStr);
        if (c.status === 'alive') alive++;
        else if (c.status === 'stale') stale++;
        else if (c.status === 'down') down++;
        else registered++;
      } catch {}
    }

    return {
      totalComponents: count,
      alive,
      stale,
      down,
      registered,
    };
  }

  async destroy() {
    this._shutdown = true;
    await this.redis.quit();
    this.removeAllListeners();
  }
}

module.exports = { HeartbeatService };
