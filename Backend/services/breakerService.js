const redis = require('ioredis');

/**
 * CIRCUIT BREAKER SERVICE
 * Emergency control system for handling critical failures
 * Implements circuit breaker pattern with state management and service isolation
 */

// ─── Redis Client Setup ──────────────────────────────────────────────────────

let redisClient;

try {
  redisClient = new redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    db: process.env.REDIS_DB || 0,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
} catch (err) {
  console.warn('Redis unavailable, using in-memory fallback');
  redisClient = null;
}

// ─── Circuit Breaker States ──────────────────────────────────────────────────

const BREAKER_STATE = {
  CLOSED: 'closed', // Normal operation
  OPEN: 'open', // Breaker tripped, service blocked
  HALF_OPEN: 'half_open', // Testing if service recovered
};

// ─── Configuration ───────────────────────────────────────────────────────────

const BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5, // Failures before opening
  SUCCESS_THRESHOLD: 2, // Successes to close from half-open
  TIMEOUT_MS: 60000, // Time before half-open attempt (1 min)
  RESET_TIMEOUT_MS: 300000, // Full reset timeout (5 min)
  MONITORED_SERVICES: [
    'trade-engine',
    'balance-service',
    'oracle-service',
    'liquidation-service',
    'blockchain-service',
    'market-data',
  ],
};

// ─── In-Memory State (Fallback) ──────────────────────────────────────────────

const memoryStore = new Map();
const activationHistory = [];
const MAX_HISTORY = 1000;

// ─── Core Circuit Breaker Functions ──────────────────────────────────────────

/**
 * Get breaker state for a service
 */
async function getBreakerState(serviceName) {
  try {
    if (redisClient) {
      const data = await redisClient.get(`breaker:${serviceName}`);
      return data ? JSON.parse(data) : createDefaultState(serviceName);
    } else {
      return memoryStore.get(serviceName) || createDefaultState(serviceName);
    }
  } catch (err) {
    console.error('Failed to get breaker state:', err);
    return createDefaultState(serviceName);
  }
}

/**
 * Set breaker state for a service
 */
async function setBreakerState(serviceName, state) {
  try {
    if (redisClient) {
      await redisClient.set(`breaker:${serviceName}`, JSON.stringify(state), 'EX', 86400); // 24h TTL
    } else {
      memoryStore.set(serviceName, state);
    }
    return state;
  } catch (err) {
    console.error('Failed to set breaker state:', err);
    return state;
  }
}

function createDefaultState(serviceName) {
  return {
    serviceName,
    state: BREAKER_STATE.CLOSED,
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
    lastStateChange: Date.now(),
    tripCount: 0,
    metadata: {},
  };
}

/**
 * Record a failure for a service
 */
async function recordFailure(serviceName, error = null) {
  const state = await getBreakerState(serviceName);

  state.failureCount++;
  state.lastFailureTime = Date.now();

  if (error) {
    state.metadata.lastError = error.message || String(error);
  }

  // Check if threshold exceeded
  if (state.state === BREAKER_STATE.CLOSED && state.failureCount >= BREAKER_CONFIG.FAILURE_THRESHOLD) {
    await tripBreaker(serviceName, `Failure threshold exceeded (${state.failureCount})`);
  } else if (state.state === BREAKER_STATE.HALF_OPEN) {
    // Failed during recovery test - reopen breaker
    await tripBreaker(serviceName, 'Recovery test failed');
  } else {
    await setBreakerState(serviceName, state);
  }

  console.warn(`[Breaker] Failure recorded for ${serviceName}`, {
    count: state.failureCount,
    state: state.state,
  });

  return state;
}

/**
 * Record a success for a service
 */
async function recordSuccess(serviceName) {
  const state = await getBreakerState(serviceName);

  if (state.state === BREAKER_STATE.HALF_OPEN) {
    state.successCount++;

    if (state.successCount >= BREAKER_CONFIG.SUCCESS_THRESHOLD) {
      await closeBreaker(serviceName, 'Recovery confirmed');
    } else {
      await setBreakerState(serviceName, state);
    }
  } else if (state.state === BREAKER_STATE.CLOSED) {
    // Reset failure count on success
    state.failureCount = Math.max(0, state.failureCount - 1);
    await setBreakerState(serviceName, state);
  }

  return state;
}

/**
 * Trip/open the circuit breaker
 */
async function tripBreaker(serviceName, reason = 'Manual trigger') {
  const state = await getBreakerState(serviceName);

  state.state = BREAKER_STATE.OPEN;
  state.lastStateChange = Date.now();
  state.tripCount++;
  state.metadata.tripReason = reason;

  await setBreakerState(serviceName, state);

  // Log to history
  logActivation({
    serviceName,
    action: 'trip',
    reason,
    timestamp: new Date(),
    previousState: state.state,
  });

  console.error(`[Breaker] TRIPPED: ${serviceName} - ${reason}`);

  // Schedule half-open attempt
  setTimeout(() => attemptHalfOpen(serviceName), BREAKER_CONFIG.TIMEOUT_MS);

  return state;
}

/**
 * Close the circuit breaker (service recovered)
 */
async function closeBreaker(serviceName, reason = 'Manual reset') {
  const state = await getBreakerState(serviceName);

  state.state = BREAKER_STATE.CLOSED;
  state.failureCount = 0;
  state.successCount = 0;
  state.lastStateChange = Date.now();
  state.metadata.closeReason = reason;

  await setBreakerState(serviceName, state);

  logActivation({
    serviceName,
    action: 'close',
    reason,
    timestamp: new Date(),
    previousState: state.state,
  });

  console.info(`[Breaker] CLOSED: ${serviceName} - ${reason}`);

  return state;
}

/**
 * Transition to half-open state for recovery testing
 */
async function attemptHalfOpen(serviceName) {
  const state = await getBreakerState(serviceName);

  if (state.state !== BREAKER_STATE.OPEN) {
    return; // Already recovered or manually changed
  }

  state.state = BREAKER_STATE.HALF_OPEN;
  state.successCount = 0;
  state.failureCount = 0;
  state.lastStateChange = Date.now();

  await setBreakerState(serviceName, state);

  logActivation({
    serviceName,
    action: 'half_open',
    reason: 'Attempting recovery',
    timestamp: new Date(),
  });

  console.info(`[Breaker] HALF-OPEN: ${serviceName} - Testing recovery`);

  return state;
}

/**
 * Check if service is allowed to execute
 */
async function isServiceAllowed(serviceName) {
  const state = await getBreakerState(serviceName);

  switch (state.state) {
    case BREAKER_STATE.CLOSED:
      return { allowed: true, state: state.state };
    case BREAKER_STATE.HALF_OPEN:
      return { allowed: true, state: state.state, testing: true };
    case BREAKER_STATE.OPEN:
      // Check if enough time passed for auto half-open
      const timeSinceTrip = Date.now() - state.lastStateChange;
      if (timeSinceTrip >= BREAKER_CONFIG.TIMEOUT_MS) {
        await attemptHalfOpen(serviceName);
        return { allowed: true, state: BREAKER_STATE.HALF_OPEN, testing: true };
      }
      return {
        allowed: false,
        state: state.state,
        reason: 'Circuit breaker open',
        retryAfter: BREAKER_CONFIG.TIMEOUT_MS - timeSinceTrip,
      };
    default:
      return { allowed: true, state: 'unknown' };
  }
}

/**
 * Execute function with circuit breaker protection
 */
async function executeWithBreaker(serviceName, fn) {
  const check = await isServiceAllowed(serviceName);

  if (!check.allowed) {
    throw new Error(`Service blocked by circuit breaker: ${serviceName} (${check.reason})`);
  }

  try {
    const result = await fn();
    await recordSuccess(serviceName);
    return result;
  } catch (err) {
    await recordFailure(serviceName, err);
    throw err;
  }
}

// ─── Breaker Management ──────────────────────────────────────────────────────

/**
 * Get status of all circuit breakers
 */
async function getAllBreakerStatus() {
  const statuses = [];

  for (const service of BREAKER_CONFIG.MONITORED_SERVICES) {
    const state = await getBreakerState(service);
    statuses.push(state);
  }

  return {
    services: statuses,
    summary: {
      total: statuses.length,
      open: statuses.filter((s) => s.state === BREAKER_STATE.OPEN).length,
      halfOpen: statuses.filter((s) => s.state === BREAKER_STATE.HALF_OPEN).length,
      closed: statuses.filter((s) => s.state === BREAKER_STATE.CLOSED).length,
    },
  };
}

/**
 * Reset specific breaker
 */
async function resetBreaker(serviceName) {
  const state = await getBreakerState(serviceName);
  
  await closeBreaker(serviceName, 'Manual reset');

  return {
    success: true,
    message: `Breaker reset for ${serviceName}`,
    previousState: state.state,
  };
}

/**
 * Reset all breakers
 */
async function resetAllBreakers() {
  const results = [];

  for (const service of BREAKER_CONFIG.MONITORED_SERVICES) {
    const result = await resetBreaker(service);
    results.push(result);
  }

  return {
    success: true,
    message: 'All breakers reset',
    results,
  };
}

/**
 * Isolate a service (force open breaker)
 */
async function isolateService(serviceName, reason = 'Manual isolation') {
  await tripBreaker(serviceName, reason);

  return {
    success: true,
    message: `Service ${serviceName} isolated`,
    reason,
  };
}

/**
 * Get activation history
 */
function getActivationHistory(filter = {}) {
  let history = [...activationHistory];

  if (filter.serviceName) {
    history = history.filter((h) => h.serviceName === filter.serviceName);
  }

  if (filter.action) {
    history = history.filter((h) => h.action === filter.action);
  }

  if (filter.limit) {
    history = history.slice(0, filter.limit);
  }

  return history;
}

function logActivation(entry) {
  activationHistory.unshift(entry);
  
  if (activationHistory.length > MAX_HISTORY) {
    activationHistory.pop();
  }
}

/**
 * Update configuration
 */
function updateConfig(newConfig) {
  Object.assign(BREAKER_CONFIG, newConfig);
  
  console.info('[Breaker] Configuration updated', BREAKER_CONFIG);
  
  return {
    success: true,
    config: BREAKER_CONFIG,
  };
}

module.exports = {
  getBreakerState,
  recordFailure,
  recordSuccess,
  tripBreaker,
  closeBreaker,
  isServiceAllowed,
  executeWithBreaker,
  getAllBreakerStatus,
  resetBreaker,
  resetAllBreakers,
  isolateService,
  getActivationHistory,
  updateConfig,
  BREAKER_STATE,
  BREAKER_CONFIG,
};
