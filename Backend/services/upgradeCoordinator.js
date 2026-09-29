const Queue = require('bull');
const { EventEmitter } = require('events');

const UPGRADE_SERVICES = ['database', 'contracts', 'api', 'indexer'];

class UpgradeCoordinator extends EventEmitter {
  constructor() {
    super();
    this.redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.upgrades = new Map();
    this.scheduledUpgrades = new Map();
    this.queue = null;
  }

  _getQueue() {
    if (!this.queue) {
      this.queue = new Queue('system-upgrades', this.redisUrl);
      this._setupQueueHandlers();
    }
    return this.queue;
  }

  _setupQueueHandlers() {
    this.queue.process(async (job) => {
      const { upgradeId } = job.data;
      return this._runUpgrade(upgradeId);
    });

    this.queue.on('progress', (job, progress) => {
      const upgrade = this.upgrades.get(job.data.upgradeId);
      if (upgrade) {
        upgrade.progress = progress;
        this.emit('progress', { upgradeId: job.data.upgradeId, progress });
      }
    });

    this.queue.on('failed', (job, err) => {
      const upgrade = this.upgrades.get(job.data.upgradeId);
      if (upgrade) {
        upgrade.status = 'failed';
        upgrade.error = err.message;
        this._attemptRollback(job.data.upgradeId);
      }
    });
  }

  createUpgrade({ version, services = UPGRADE_SERVICES, metadata = {} }) {
    const upgradeId = `upg_${Date.now()}`;
    const upgrade = {
      id: upgradeId,
      version,
      services,
      metadata,
      status: 'pending',
      progress: 0,
      currentService: null,
      completedServices: [],
      failedServices: [],
      startedAt: null,
      completedAt: null,
      scheduledFor: null,
      error: null,
    };
    this.upgrades.set(upgradeId, upgrade);
    return upgrade;
  }

  scheduleUpgrade(upgradeId, scheduledFor) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) throw new Error(`Upgrade not found: ${upgradeId}`);

    const scheduleTime = new Date(scheduledFor);
    if (isNaN(scheduleTime.getTime())) {
      throw new Error('Invalid schedule time');
    }

    const delay = scheduleTime.getTime() - Date.now();
    if (delay < 0) throw new Error('Schedule time must be in the future');

    upgrade.status = 'scheduled';
    upgrade.scheduledFor = scheduleTime.toISOString();
    this.scheduledUpgrades.set(upgradeId, scheduleTime);

    return this._getQueue().add(
      { upgradeId },
      { delay, jobId: upgradeId, removeOnComplete: false, removeOnFail: false },
    );
  }

  async startUpgrade(upgradeId) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) throw new Error(`Upgrade not found: ${upgradeId}`);
    if (['running', 'completed'].includes(upgrade.status)) {
      throw new Error(`Upgrade already ${upgrade.status}`);
    }

    upgrade.status = 'running';
    upgrade.startedAt = new Date().toISOString();
    await this._getQueue().add({ upgradeId }, { jobId: `${upgradeId}_immediate` });
    return upgrade;
  }

  async _runUpgrade(upgradeId) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) throw new Error(`Upgrade not found: ${upgradeId}`);

    const total = upgrade.services.length;
    for (let i = 0; i < total; i++) {
      const service = upgrade.services[i];
      upgrade.currentService = service;
      upgrade.progress = Math.round((i / total) * 100);

      try {
        await this._upgradeService(service, upgrade.version);
        upgrade.completedServices.push(service);
        upgrade.progress = Math.round(((i + 1) / total) * 100);
        this.emit('service-upgraded', { upgradeId, service, progress: upgrade.progress });
      } catch (err) {
        upgrade.failedServices.push({ service, error: err.message });
        upgrade.status = 'failed';
        upgrade.error = err.message;
        await this._attemptRollback(upgradeId);
        throw err;
      }
    }

    upgrade.status = 'completed';
    upgrade.progress = 100;
    upgrade.currentService = null;
    upgrade.completedAt = new Date().toISOString();
    return upgrade;
  }

  async _upgradeService(service, version) {
    const handlers = {
      database: async () => {
        const migrationService = require('./migrationService');
        await migrationService.connectDatabases();
      },
      contracts: async () => {
        await new Promise((r) => setTimeout(r, 100));
      },
      api: async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
      indexer: async () => {
        await new Promise((r) => setTimeout(r, 50));
      },
    };

    const handler = handlers[service];
    if (!handler) throw new Error(`Unknown service: ${service}`);
    await handler(version);
  }

  async _attemptRollback(upgradeId) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return;

    upgrade.status = 'rolling_back';
    const reversed = [...upgrade.completedServices].reverse();

    for (const service of reversed) {
      try {
        await this._rollbackService(service, upgrade.version);
        upgrade.completedServices = upgrade.completedServices.filter((s) => s !== service);
      } catch (err) {
        upgrade.error = `Rollback failed for ${service}: ${err.message}`;
      }
    }

    upgrade.status = upgrade.completedServices.length > 0 ? 'partial_rollback' : 'rolled_back';
    this.emit('rollback', { upgradeId, status: upgrade.status });
  }

  async _rollbackService(service) {
    const handlers = {
      database: async () => {
        const migrationService = require('./migrationService');
        const status = migrationService.getStatus();
        const last = status.history.filter((h) => h.status === 'completed').pop();
        if (last) await migrationService.rollback(last.id);
      },
      contracts: async () => {},
      api: async () => {},
      indexer: async () => {},
    };
    const handler = handlers[service];
    if (handler) await handler();
  }

  async rollbackUpgrade(upgradeId) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) throw new Error(`Upgrade not found: ${upgradeId}`);
    await this._attemptRollback(upgradeId);
    return this.getStatus(upgradeId);
  }

  getStatus(upgradeId) {
    if (upgradeId) {
      const upgrade = this.upgrades.get(upgradeId);
      if (!upgrade) return null;
      return { ...upgrade };
    }

    return {
      total: this.upgrades.size,
      upgrades: Array.from(this.upgrades.values()).map((u) => ({
        id: u.id,
        version: u.version,
        status: u.status,
        progress: u.progress,
        scheduledFor: u.scheduledFor,
      })),
    };
  }

  getProgress(upgradeId) {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return null;
    return {
      id: upgrade.id,
      status: upgrade.status,
      progress: upgrade.progress,
      currentService: upgrade.currentService,
      completedServices: upgrade.completedServices,
      failedServices: upgrade.failedServices,
      error: upgrade.error,
    };
  }

  async close() {
    if (this.queue) await this.queue.close();
  }
}

module.exports = new UpgradeCoordinator();
