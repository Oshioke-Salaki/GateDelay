const upgradeCoordinator = require('../services/upgradeCoordinator');

const POLL_INTERVAL = 5000;

class UpgradeManager {
  constructor() {
    this.running = false;
    this.intervalId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;

    upgradeCoordinator.on('progress', ({ upgradeId, progress }) => {
      console.log(`[UpgradeManager] ${upgradeId} progress: ${progress}%`);
    });

    upgradeCoordinator.on('service-upgraded', ({ upgradeId, service, progress }) => {
      console.log(`[UpgradeManager] ${upgradeId} upgraded ${service} (${progress}%)`);
    });

    upgradeCoordinator.on('rollback', ({ upgradeId, status }) => {
      console.log(`[UpgradeManager] ${upgradeId} rollback status: ${status}`);
    });

    this.intervalId = setInterval(() => this._pollScheduled(), POLL_INTERVAL);
    console.log('[UpgradeManager] Started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('[UpgradeManager] Stopped');
  }

  _pollScheduled() {
    const now = Date.now();
    for (const [upgradeId, scheduleTime] of upgradeCoordinator.scheduledUpgrades) {
      if (scheduleTime.getTime() <= now) {
        const upgrade = upgradeCoordinator.upgrades.get(upgradeId);
        if (upgrade && upgrade.status === 'scheduled') {
          upgradeCoordinator.startUpgrade(upgradeId).catch((err) => {
            console.error(`[UpgradeManager] Failed to start ${upgradeId}:`, err.message);
          });
        }
        upgradeCoordinator.scheduledUpgrades.delete(upgradeId);
      }
    }
  }

  async createAndRun({ version, services, scheduledFor }) {
    const upgrade = upgradeCoordinator.createUpgrade({ version, services });
    if (scheduledFor) {
      await upgradeCoordinator.scheduleUpgrade(upgrade.id, scheduledFor);
      return upgrade;
    }
    await upgradeCoordinator.startUpgrade(upgrade.id);
    return upgrade;
  }
}

module.exports = new UpgradeManager();
