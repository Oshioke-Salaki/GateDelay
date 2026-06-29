const sanityChecker = require('../services/sanityChecker');
const mongoose = require('mongoose');

/**
 * SANITY CHECK JOB
 * Background job for continuous market sanity monitoring
 * Runs checks on schedule and generates alerts for issues
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  CHECK_INTERVAL_MS: 300000, // Check every 5 minutes
  MONITORED_PAIRS: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT'], // Default pairs to monitor
  AUTO_START: false, // Manual start by default
  CONCURRENT_CHECKS: 3, // Max concurrent pair checks
};

// ─── State Management ────────────────────────────────────────────────────────

let jobActive = false;
let intervalId = null;
let checksRun = 0;
let issuesDetected = 0;
let lastCheckTime = null;

// ─── Logging ─────────────────────────────────────────────────────────────────

function logJob(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SanityCheck:${level}] ${timestamp}:`, message, data);
}

// ─── Check Execution ─────────────────────────────────────────────────────────

/**
 * Run sanity check for a single pair
 */
async function checkPair(pair) {
  try {
    logJob('info', `Running sanity check for ${pair}`);

    const report = await sanityChecker.generateHealthReport(pair);

    if (!report.healthy) {
      issuesDetected++;
      logJob('warn', `Health issues detected for ${pair}`, {
        status: report.overallStatus,
        issueCount: report.state.issues.length,
        anomalyCount: report.anomalies.anomalies.length,
      });
    } else {
      logJob('info', `${pair} health check passed`);
    }

    return report;
  } catch (err) {
    logJob('error', `Failed to check ${pair}`, { error: err.message });
    return {
      pair,
      error: err.message,
      healthy: false,
    };
  }
}

/**
 * Run sanity checks for all monitored pairs
 */
async function runSanityChecks() {
  if (!jobActive) return;

  try {
    checksRun++;
    lastCheckTime = new Date();

    logJob('info', `Starting sanity check cycle (${checksRun})`, {
      pairs: CONFIG.MONITORED_PAIRS.length,
    });

    // Run checks in batches to avoid overwhelming the system
    const reports = [];
    
    for (let i = 0; i < CONFIG.MONITORED_PAIRS.length; i += CONFIG.CONCURRENT_CHECKS) {
      const batch = CONFIG.MONITORED_PAIRS.slice(i, i + CONFIG.CONCURRENT_CHECKS);
      const batchReports = await Promise.all(batch.map(checkPair));
      reports.push(...batchReports);
    }

    const unhealthyCount = reports.filter((r) => !r.healthy).length;

    logJob('info', `Sanity check cycle complete`, {
      total: reports.length,
      healthy: reports.length - unhealthyCount,
      unhealthy: unhealthyCount,
    });

    // Send summary alert if multiple markets are unhealthy
    if (unhealthyCount >= 2) {
      const criticalAlert = {
        type: 'system',
        severity: 'critical',
        message: `Multiple markets unhealthy (${unhealthyCount}/${reports.length})`,
        unhealthyPairs: reports.filter((r) => !r.healthy).map((r) => r.pair),
      };

      logJob('error', 'CRITICAL: Multiple market health issues', criticalAlert);
    }

    return reports;
  } catch (err) {
    logJob('error', 'Sanity check cycle failed', { error: err.message });
    return [];
  }
}

/**
 * Perform deep check on specific pair (more thorough analysis)
 */
async function deepCheck(pair) {
  logJob('info', `Running deep check for ${pair}`);

  try {
    const [state, anomalies, manipulation] = await Promise.all([
      sanityChecker.validateMarketState(pair),
      sanityChecker.detectAnomalousPatterns(pair, 24 * 60 * 60 * 1000), // 24h window
      sanityChecker.detectManipulation(pair),
    ]);

    const deepReport = {
      pair,
      timestamp: new Date(),
      checkType: 'deep',
      state,
      anomalies,
      manipulation,
      recommendation: generateRecommendation(state, anomalies, manipulation),
    };

    logJob('info', `Deep check complete for ${pair}`, {
      recommendation: deepReport.recommendation,
    });

    return deepReport;
  } catch (err) {
    logJob('error', `Deep check failed for ${pair}`, { error: err.message });
    return { pair, error: err.message };
  }
}

function generateRecommendation(state, anomalies, manipulation) {
  const recommendations = [];

  if (!state.valid) {
    recommendations.push('CRITICAL: Market state validation failed - consider pausing trading');
  }

  if (state.issues.some((i) => i.type === 'liquidity')) {
    recommendations.push('Low liquidity detected - increase market maker incentives');
  }

  if (manipulation.flagged) {
    recommendations.push('URGENT: Manipulation detected - investigate flagged accounts');
  }

  if (anomalies.anomalies.some((a) => a.type === 'price_spike')) {
    recommendations.push('Price volatility detected - review recent trades');
  }

  if (recommendations.length === 0) {
    return 'No action required - market operating normally';
  }

  return recommendations.join('; ');
}

// ─── Job Control ─────────────────────────────────────────────────────────────

/**
 * Start sanity check job
 */
function startJob(options = {}) {
  if (jobActive) {
    logJob('warn', 'Sanity check job already running');
    return { success: false, message: 'Job already active' };
  }

  // Apply options
  if (options.interval) {
    CONFIG.CHECK_INTERVAL_MS = options.interval;
  }

  if (options.pairs) {
    CONFIG.MONITORED_PAIRS = options.pairs;
  }

  jobActive = true;
  logJob('info', 'Starting sanity check job', {
    interval: CONFIG.CHECK_INTERVAL_MS,
    pairs: CONFIG.MONITORED_PAIRS,
  });

  // Run immediately
  runSanityChecks();

  // Schedule recurring checks
  intervalId = setInterval(runSanityChecks, CONFIG.CHECK_INTERVAL_MS);

  return {
    success: true,
    message: 'Sanity check job started',
    config: CONFIG,
  };
}

/**
 * Stop sanity check job
 */
function stopJob() {
  if (!jobActive) {
    logJob('warn', 'Sanity check job not running');
    return { success: false, message: 'Job not active' };
  }

  jobActive = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  logJob('info', 'Sanity check job stopped', {
    checksRun,
    issuesDetected,
  });

  return {
    success: true,
    message: 'Sanity check job stopped',
    stats: getStats(),
  };
}

/**
 * Run check immediately (manual trigger)
 */
async function checkNow(pair = null) {
  if (pair) {
    logJob('info', `Manual check triggered for ${pair}`);
    return checkPair(pair);
  } else {
    logJob('info', 'Manual full check triggered');
    return runSanityChecks();
  }
}

/**
 * Add pair to monitoring list
 */
function addPair(pair) {
  if (CONFIG.MONITORED_PAIRS.includes(pair)) {
    return { success: false, message: 'Pair already monitored' };
  }

  CONFIG.MONITORED_PAIRS.push(pair);
  logJob('info', `Added ${pair} to monitoring`, { totalPairs: CONFIG.MONITORED_PAIRS.length });

  return {
    success: true,
    message: `${pair} added to monitoring`,
    monitoredPairs: CONFIG.MONITORED_PAIRS,
  };
}

/**
 * Remove pair from monitoring list
 */
function removePair(pair) {
  const index = CONFIG.MONITORED_PAIRS.indexOf(pair);
  
  if (index === -1) {
    return { success: false, message: 'Pair not monitored' };
  }

  CONFIG.MONITORED_PAIRS.splice(index, 1);
  logJob('info', `Removed ${pair} from monitoring`, { totalPairs: CONFIG.MONITORED_PAIRS.length });

  return {
    success: true,
    message: `${pair} removed from monitoring`,
    monitoredPairs: CONFIG.MONITORED_PAIRS,
  };
}

/**
 * Get job statistics
 */
function getStats() {
  return {
    active: jobActive,
    checksRun,
    issuesDetected,
    lastCheckTime,
    config: CONFIG,
    detectionRate: checksRun > 0 ? (issuesDetected / checksRun).toFixed(3) : 0,
  };
}

/**
 * Reset statistics
 */
function resetStats() {
  checksRun = 0;
  issuesDetected = 0;
  lastCheckTime = null;
  
  logJob('info', 'Statistics reset');
  
  return { success: true, message: 'Stats reset' };
}

/**
 * Update configuration
 */
function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
  
  logJob('info', 'Configuration updated', { config: CONFIG });
  
  return {
    success: true,
    config: CONFIG,
  };
}

// ─── Auto-start (if configured) ──────────────────────────────────────────────

if (CONFIG.AUTO_START) {
  setTimeout(() => {
    logJob('info', 'Auto-starting sanity check job');
    startJob();
  }, 5000); // Wait 5s after startup
}

module.exports = {
  startJob,
  stopJob,
  checkNow,
  deepCheck,
  addPair,
  removePair,
  getStats,
  resetStats,
  updateConfig,
  CONFIG,
};
