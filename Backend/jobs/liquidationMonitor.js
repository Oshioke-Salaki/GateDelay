const liquidationService = require('../services/liquidationService');
const Collateral = require('../models/Collateral');
const logger = require('../utils/logger'); // Assumes logger exists

/**
 * LIQUIDATION MONITOR JOB
 * Background job to continuously monitor positions for liquidation
 * Runs on schedule (e.g., every minute)
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  CHECK_INTERVAL_MS: 60000, // Check every 60 seconds
  BATCH_SIZE: 50, // Process 50 at a time
  MAX_RETRIES: 3, // Retry failed liquidations
  RETRY_DELAY_MS: 5000, // Wait 5s before retry
  AUTO_EXECUTE: false, // Manual execution only (safe default)
  LIQUIDATION_TIMEOUT_MS: 30000, // 30s timeout for execution
};

// ─── In-Memory State ──────────────────────────────────────────────────────────

let monitoringActive = false;
let lastCheckTime = null;
let checksRun = 0;
let positionsMonitored = 0;
let liquidationsDetected = 0;
let liquidationsExecuted = 0;

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Log monitoring event
 */
function logEvent(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    message,
    ...data,
    monitoring: {
      checksRun,
      positionsMonitored,
      liquidationsDetected,
      liquidationsExecuted,
    },
  };

  if (logger) {
    logger[level](message, logData);
  } else {
    console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`, logData);
  }
}

/**
 * Check if position should be liquidated
 */
async function evaluatePosition(collateral) {
  try {
    const isUndercollateralized = new (require('big.js'))(
      collateral.collateralizationRatio,
    ).lte(new (require('big.js'))(collateral.liquidationThreshold));

    return {
      collateralId: collateral._id,
      userId: collateral.userId,
      assetSymbol: collateral.assetSymbol,
      currentRatio: collateral.collateralizationRatio,
      isUndercollateralized,
      needsLiquidation: isUndercollateralized && collateral.status === 'Active',
    };
  } catch (error) {
    logEvent('error', `Failed to evaluate position: ${collateral._id}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Execute liquidation with retry logic
 */
async function tryLiquidatePosition(collateral, retryCount = 0) {
  try {
    // Prepare liquidation
    const liquidationResult = await liquidationService.executeLiquidation({
      positionId: collateral._id,
      collateralId: collateral._id,
      liquidatorAddress: CONFIG.LIQUIDATOR_ADDRESS || 'system',
      executionPrice: collateral.currentValue,
    });

    if (liquidationResult.success) {
      liquidationsExecuted++;
      logEvent('info', `Liquidation executed: ${collateral._id}`, {
        penalty: liquidationResult.data.penaltyAmount,
        bonus: liquidationResult.data.liquidatorBonus,
      });
      return {
        success: true,
        liquidationId: liquidationResult.data.liquidationId,
      };
    }
  } catch (error) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      logEvent(
        'warn',
        `Liquidation retry ${retryCount + 1}/${CONFIG.MAX_RETRIES}: ${collateral._id}`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.RETRY_DELAY_MS),
      );
      return tryLiquidatePosition(collateral, retryCount + 1);
    }

    logEvent('error', `Liquidation failed after retries: ${collateral._id}`, {
      retries: CONFIG.MAX_RETRIES,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

// ─── Main Monitoring Functions ───────────────────────────────────────────────

/**
 * MONITOR BATCH
 * Check a batch of positions for liquidation
 */
async function monitorBatch(page = 1) {
  try {
    // Get batch of active positions
    const skip = (page - 1) * CONFIG.BATCH_SIZE;
    const batch = await Collateral.find({
      status: { $in: ['Active', 'Liquidating'] },
      isLiquidationTriggered: false, // Only check non-triggered
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(CONFIG.BATCH_SIZE)
      .lean();

    if (batch.length === 0) {
      return { checked: 0, needsLiquidation: [] };
    }

    positionsMonitored += batch.length;

    // Evaluate each position
    const results = await Promise.all(batch.map(evaluatePosition));
    const needsLiquidation = results.filter((r) => r && r.needsLiquidation);

    logEvent('info', `Monitored batch ${page}`, {
      batchSize: batch.length,
      undercollateralized: needsLiquidation.length,
    });

    return { checked: batch.length, needsLiquidation };
  } catch (error) {
    logEvent('error', `Failed to monitor batch ${page}`, {
      error: error.message,
    });
    return { checked: 0, needsLiquidation: [] };
  }
}

/**
 * PROCESS LIQUIDATIONS
 * Execute liquidations for undercollateralized positions
 */
async function processLiquidations(candidates) {
  if (candidates.length === 0) return [];

  logEvent('info', `Processing ${candidates.length} liquidation candidates`);

  const results = [];

  for (const candidate of candidates) {
    try {
      const collateral = await Collateral.findById(candidate.collateralId);
      if (!collateral) {
        logEvent('warn', `Collateral not found: ${candidate.collateralId}`);
        continue;
      }

      liquidationsDetected++;

      if (!CONFIG.AUTO_EXECUTE) {
        logEvent(
          'info',
          `Liquidation candidate flagged (auto-execute disabled)`,
          {
            collateralId: candidate.collateralId,
            ratio: candidate.currentRatio,
          },
        );
        results.push({
          collateralId: candidate.collateralId,
          status: 'flagged',
          reason: 'auto-execute disabled',
        });
        continue;
      }

      // Execute liquidation
      const execution = await Promise.race([
        tryLiquidatePosition(collateral),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Liquidation timeout')),
            CONFIG.LIQUIDATION_TIMEOUT_MS,
          ),
        ),
      ]);

      results.push({
        collateralId: candidate.collateralId,
        status: execution.success ? 'executed' : 'failed',
        liquidationId: execution.liquidationId,
        error: execution.error,
      });
    } catch (error) {
      logEvent(
        'error',
        `Failed to process liquidation: ${candidate.collateralId}`,
        {
          error: error.message,
        },
      );
      results.push({
        collateralId: candidate.collateralId,
        status: 'error',
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * SCAN ALL POSITIONS
 * Full scan across all pages
 */
async function scanAllPositions() {
  logEvent('info', 'Starting full position scan');

  const allCandidates = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { checked, needsLiquidation } = await monitorBatch(page);

    if (needsLiquidation.length > 0) {
      allCandidates.push(...needsLiquidation);
      logEvent(
        'info',
        `Found ${needsLiquidation.length} candidates on page ${page}`,
      );
    }

    hasMore = checked === CONFIG.BATCH_SIZE;
    page++;
  }

  return allCandidates;
}

/**
 * RUN MONITORING CYCLE
 * Complete monitoring and liquidation cycle
 */
async function runMonitoringCycle() {
  if (!monitoringActive) return;

  try {
    checksRun++;
    lastCheckTime = new Date();

    logEvent('info', 'Starting liquidation monitoring cycle');

    // Scan all positions
    const candidates = await scanAllPositions();

    // Process liquidations
    if (candidates.length > 0) {
      const executionResults = await processLiquidations(candidates);
      logEvent('info', `Liquidation cycle complete`, {
        total: candidates.length,
        flagged: executionResults.filter((r) => r.status === 'flagged').length,
        executed: executionResults.filter((r) => r.status === 'executed')
          .length,
        failed: executionResults.filter((r) => r.status === 'failed').length,
      });
    } else {
      logEvent('debug', 'No liquidation candidates detected');
    }
  } catch (error) {
    logEvent('error', 'Liquidation monitoring cycle failed', {
      error: error.message,
    });
  }
}

// ─── Job Control Functions ───────────────────────────────────────────────────

/**
 * START MONITORING
 * Begin continuous monitoring
 */
function startMonitoring(interval = CONFIG.CHECK_INTERVAL_MS) {
  if (monitoringActive) {
    logEvent('warn', 'Monitoring already active');
    return;
  }

  monitoringActive = true;
  logEvent('info', `Starting liquidation monitor (interval: ${interval}ms)`);

  // Run immediately
  runMonitoringCycle();

  // Schedule interval
  const intervalId = setInterval(runMonitoringCycle, interval);

  return {
    stop: () => {
      monitoringActive = false;
      clearInterval(intervalId);
      logEvent('info', 'Liquidation monitor stopped');
    },
    stats: () => getMonitoringStats(),
  };
}

/**
 * STOP MONITORING
 */
function stopMonitoring() {
  monitoringActive = false;
  logEvent('info', 'Stopping liquidation monitor');
}

/**
 * GET MONITORING STATS
 */
function getMonitoringStats() {
  return {
    isActive: monitoringActive,
    lastCheckTime,
    checksRun,
    positionsMonitored,
    liquidationsDetected,
    liquidationsExecuted,
    stats: {
      averagePositionsPerCheck: positionsMonitored / checksRun || 0,
      detectionRate: liquidationsDetected / positionsMonitored || 0,
      executionSuccessRate: liquidationsExecuted / liquidationsDetected || 0,
    },
  };
}

/**
 * RESET STATS
 */
function resetStats() {
  checksRun = 0;
  positionsMonitored = 0;
  liquidationsDetected = 0;
  liquidationsExecuted = 0;
  lastCheckTime = null;
}

/**
 * CHECK NOW
 * Trigger immediate check
 */
async function checkNow() {
  logEvent('info', 'Manual check triggered');
  return runMonitoringCycle();
}

/**
 * SET CONFIG
 * Update configuration
 */
function setConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
  logEvent('info', 'Configuration updated', { config: CONFIG });
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  getMonitoringStats,
  resetStats,
  checkNow,
  setConfig,
  monitorBatch,
  processLiquidations,
  scanAllPositions,
  CONFIG,
};
