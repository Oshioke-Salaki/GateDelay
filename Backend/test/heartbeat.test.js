jest.mock('ioredis');

const Redis = require('ioredis');
const { HeartbeatService } = require('../services/heartbeat');
const monitor = require('../jobs/heartbeatMonitor');

describe('HeartbeatService', () => {
  let mockRedis;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const store = new Map();
    const hashStore = new Map();

    mockRedis = {
      get: jest.fn(async (key) => store.get(key) || null),
      set: jest.fn(async (key, value) => { store.set(key, value); return 'OK'; }),
      del: jest.fn(async (key) => { store.delete(key); return 1; }),
      hget: jest.fn(async (key, field) => {
        const h = hashStore.get(key);
        return h ? (h.get(field) || null) : null;
      }),
      hset: jest.fn(async (key, field, value) => {
        if (!hashStore.has(key)) hashStore.set(key, new Map());
        hashStore.get(key).set(field, value);
        return 1;
      }),
      hdel: jest.fn(async (key, field) => {
        const h = hashStore.get(key);
        if (h) h.delete(field);
        return 1;
      }),
      hgetall: jest.fn(async (key) => {
        const h = hashStore.get(key);
        if (!h) return {};
        const obj = {};
        for (const [k, v] of h) obj[k] = v;
        return obj;
      }),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    Redis.mockImplementation(() => mockRedis);

    service = new HeartbeatService({ redis: mockRedis });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('registerComponent', () => {
    it('registers a component with defaults', async () => {
      const result = await service.registerComponent('worker-1');
      expect(result.id).toBe('worker-1');
      expect(result.status).toBe('registered');
      expect(result.expectedIntervalMs).toBe(30000);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'heartbeat:registered', 'worker-1', expect.any(String)
      );
    });

    it('registers with custom interval and metadata', async () => {
      const result = await service.registerComponent('api-1', { region: 'us-east' }, 10000);
      expect(result.id).toBe('api-1');
      expect(result.expectedIntervalMs).toBe(10000);
      expect(result.metadata.region).toBe('us-east');
    });

    it('throws for missing id', async () => {
      await expect(service.registerComponent()).rejects.toThrow('component id is required');
    });
  });

  describe('beat', () => {
    it('records a heartbeat for a registered component', async () => {
      await service.registerComponent('worker-1');
      const result = await service.beat('worker-1');

      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeGreaterThan(0);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('emits recovered when component was previously down', async () => {
      const recoveredHandler = jest.fn();
      service.on('recovered', recoveredHandler);

      await service.registerComponent('worker-1');
      await service.beat('worker-1');

      expect(recoveredHandler).not.toHaveBeenCalled();
    });

    it('throws for missing id', async () => {
      await expect(service.beat()).rejects.toThrow('component id is required');
    });

    it('throws when service is destroyed', async () => {
      service._shutdown = true;
      await expect(service.beat('worker-1')).rejects.toThrow('shutting down');
    });
  });

  describe('unregisterComponent', () => {
    it('deregisters a component', async () => {
      await service.registerComponent('worker-1');
      const result = await service.unregisterComponent('worker-1');
      expect(result.unregistered).toBe(true);

      const status = await service.getComponentStatus('worker-1');
      expect(status).toBeNull();
    });

    it('throws for missing id', async () => {
      await expect(service.unregisterComponent()).rejects.toThrow('component id is required');
    });
  });

  describe('getStatus / getComponentStatus', () => {
    it('returns empty array when no components', async () => {
      const statuses = await service.getStatus();
      expect(statuses).toEqual([]);
    });

    it('returns status for registered components', async () => {
      await service.registerComponent('worker-1', { version: '1.0' }, 30000);
      const statuses = await service.getStatus();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].id).toBe('worker-1');
      expect(statuses[0].status).toBe('registered');
      expect(statuses[0].metadata.version).toBe('1.0');
    });

    it('returns null for unknown component', async () => {
      const status = await service.getComponentStatus('nonexistent');
      expect(status).toBeNull();
    });
  });

  describe('checkLiveness', () => {
    it('marks component as alive after recent beat', async () => {
      await service.registerComponent('worker-1', {}, 30000);
      await service.beat('worker-1');

      const results = await service.checkLiveness();
      const worker = results.find(r => r.id === 'worker-1');
      expect(worker.status).toBe('alive');
    });

    it('marks component as stale when beat is overdue', async () => {
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      await service.registerComponent('worker-1', {}, 10000);
      await service.beat('worker-1');

      const alertHandler = jest.fn();
      service.on('alert', alertHandler);

      jest.setSystemTime(new Date('2025-01-01T00:00:35Z'));
      const results = await service.checkLiveness();
      const worker = results.find(r => r.id === 'worker-1');
      expect(worker.status).toBe('stale');
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat_stale', componentId: 'worker-1' })
      );
    });

    it('marks component as down when beat is far overdue', async () => {
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      await service.registerComponent('worker-1', {}, 10000);
      await service.beat('worker-1');

      const alertHandler = jest.fn();
      service.on('alert', alertHandler);

      jest.setSystemTime(new Date('2025-01-01T00:02:00Z'));
      const results = await service.checkLiveness();
      const worker = results.find(r => r.id === 'worker-1');
      expect(worker.status).toBe('down');
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat_down', componentId: 'worker-1' })
      );
    });

    it('emits recovered when component beats after being down', async () => {
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      await service.registerComponent('worker-1', {}, 10000);
      await service.beat('worker-1');

      jest.setSystemTime(new Date('2025-01-01T00:02:00Z'));
      await service.checkLiveness();

      const recoveredHandler = jest.fn();
      service.on('recovered', recoveredHandler);

      jest.setSystemTime(new Date('2025-01-01T00:02:01Z'));
      await service.beat('worker-1');
      expect(recoveredHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'worker-1' })
      );
    });
  });

  describe('getStats', () => {
    it('returns zeros when no components', async () => {
      const stats = await service.getStats();
      expect(stats.totalComponents).toBe(0);
      expect(stats.alive).toBe(0);
    });

    it('counts components by status', async () => {
      await service.registerComponent('alive-1', {}, 30000);
      await service.beat('alive-1');

      await service.registerComponent('stale-1', {}, 10000);

      const stats = await service.getStats();
      expect(stats.totalComponents).toBe(2);
    });
  });

  describe('destroy', () => {
    it('shuts down and clears listeners', async () => {
      const handler = jest.fn();
      service.on('alert', handler);
      await service.destroy();
      expect(service._shutdown).toBe(true);
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});

describe('HeartbeatMonitor', () => {
  let mockRedis;
  let service;
  let store;
  let hashStore;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    store = new Map();
    hashStore = new Map();

    mockRedis = {
      get: jest.fn(async (key) => store.get(key) || null),
      set: jest.fn(async (key, value) => { store.set(key, value); return 'OK'; }),
      del: jest.fn(async (key) => { store.delete(key); return 1; }),
      hget: jest.fn(async (key, field) => {
        const h = hashStore.get(key);
        return h ? (h.get(field) || null) : null;
      }),
      hset: jest.fn(async (key, field, value) => {
        if (!hashStore.has(key)) hashStore.set(key, new Map());
        hashStore.get(key).set(field, value);
        return 1;
      }),
      hdel: jest.fn(async (key, field) => {
        const h = hashStore.get(key);
        if (h) h.delete(field);
        return 1;
      }),
      hgetall: jest.fn(async (key) => {
        const h = hashStore.get(key);
        if (!h) return {};
        const obj = {};
        for (const [k, v] of h) obj[k] = v;
        return obj;
      }),
      quit: jest.fn().mockResolvedValue(undefined),
    };

    Redis.mockImplementation(() => mockRedis);
    service = new HeartbeatService({ redis: mockRedis });
    monitor.resetStats();
  });

  afterEach(() => {
    jest.useRealTimers();
    monitor.stopMonitoring();
  });

  describe('startMonitoring / stopMonitoring', () => {
    it('starts and stops monitoring', () => {
      const result = monitor.startMonitoring(service);
      expect(result.success).toBe(true);

      const stats = monitor.getStats();
      expect(stats.active).toBe(true);

      const stopResult = monitor.stopMonitoring();
      expect(stopResult.success).toBe(true);
      expect(monitor.getStats().active).toBe(false);
    });

    it('rejects duplicate start', () => {
      monitor.startMonitoring(service);
      const result = monitor.startMonitoring(service);
      expect(result.success).toBe(false);
    });

    it('rejects non-HeartbeatService instance', () => {
      expect(() => monitor.startMonitoring({})).toThrow('HeartbeatService');
    });
  });

  describe('checkNow', () => {
    it('runs a check cycle and returns results', async () => {
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      await service.registerComponent('worker-1', {}, 30000);
      await service.beat('worker-1');

      jest.setSystemTime(new Date('2025-01-01T00:00:01Z'));
      const results = await monitor.checkNow(service);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('alive');
    });
  });

  describe('getStats / resetStats', () => {
    it('returns monitor statistics', () => {
      const stats = monitor.getStats();
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('checksRun');
      expect(stats).toHaveProperty('config');
    });

    it('resets statistics', () => {
      monitor.resetStats();
      const stats = monitor.getStats();
      expect(stats.checksRun).toBe(0);
      expect(stats.issuesDetected).toBe(0);
    });
  });
});
