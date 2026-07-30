const { HeartbeatService } = require('../services/heartbeat');

const CONFIG = {
  CHECK_INTERVAL_MS: 15000,
  AUTO_START: false,
};

let monitorActive = false;
let intervalId = null;
let checksRun = 0;
let issuesDetected = 0;
let alertsSent = 0;
let lastCheckTime = null;

function logEvent(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[HeartbeatMonitor:${level}] ${timestamp}: ${message}`, data);
}

async function runMonitorCycle(service) {
  if (!monitorActive) return;

  try {
    checksRun++;
    lastCheckTime = new Date();
    logEvent('info', `Monitor cycle ${checksRun} starting`);

    const results = await service.checkLiveness();

    const staleOrDown = results.filter(r => r.status === 'stale' || r.status === 'down');
    if (staleOrDown.length > 0) {
      issuesDetected += staleOrDown.length;
      logEvent('warn', `${staleOrDown.length} component(s) unhealthy`, {
        components: staleOrDown.map(r => ({ id: r.id, status: r.status })),
      });
    }

    logEvent('info', `Monitor cycle complete`, {
      total: results.length,
      healthy: results.filter(r => r.status === 'alive' || r.status === 'registered').length,
      stale: staleOrDown.filter(r => r.status === 'stale').length,
      down: staleOrDown.filter(r => r.status === 'down').length,
    });

    return results;
  } catch (err) {
    logEvent('error', 'Monitor cycle failed', { error: err.message });
    return [];
  }
}

function startMonitoring(service, interval = CONFIG.CHECK_INTERVAL_MS) {
  if (monitorActive) {
    logEvent('warn', 'Monitor already active');
    return { success: false, message: 'Monitor already active' };
  }

  if (!(service instanceof HeartbeatService)) {
    throw new Error('service must be an instance of HeartbeatService');
  }

  monitorActive = true;
  logEvent('info', `Starting heartbeat monitor (interval: ${interval}ms)`);

  runMonitorCycle(service);

  intervalId = setInterval(() => runMonitorCycle(service), interval);

  return {
    success: true,
    message: 'Heartbeat monitor started',
    interval,
    stop: () => stopMonitoring(),
    stats: () => getStats(),
  };
}

function stopMonitoring() {
  if (!monitorActive) {
    logEvent('warn', 'Monitor not active');
    return { success: false, message: 'Monitor not active' };
  }

  monitorActive = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  logEvent('info', 'Heartbeat monitor stopped', { checksRun, issuesDetected, alertsSent });

  return {
    success: true,
    message: 'Heartbeat monitor stopped',
    stats: getStats(),
  };
}

async function checkNow(service) {
  if (!(service instanceof HeartbeatService)) {
    throw new Error('service must be an instance of HeartbeatService');
  }
  logEvent('info', 'Manual check triggered');
  monitorActive = true;
  const results = await runMonitorCycle(service);
  monitorActive = false;
  return results;
}

function getStats() {
  return {
    active: monitorActive,
    checksRun,
    issuesDetected,
    alertsSent,
    lastCheckTime,
    config: { ...CONFIG },
    detectionRate: checksRun > 0 ? (issuesDetected / checksRun).toFixed(3) : 0,
  };
}

function resetStats() {
  checksRun = 0;
  issuesDetected = 0;
  alertsSent = 0;
  lastCheckTime = null;
  logEvent('info', 'Statistics reset');
  return { success: true, message: 'Stats reset' };
}

if (CONFIG.AUTO_START) {
  setTimeout(() => {
    const service = new HeartbeatService();
    startMonitoring(service);
  }, 5000);
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  checkNow,
  getStats,
  resetStats,
  CONFIG,
};
