/**
 * PAUSE SERVICE
 * Manages market pause and unpause operations with permission control,
 * status tracking, duration monitoring, and event logging.
 *
 * Dependencies: web3.js, mongoose
 */

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────── Constants

const PAUSE_STATES = {
  ACTIVE: 'ACTIVE',       // Market is running normally
  PAUSED: 'PAUSED',       // Market is paused
  EMERGENCY: 'EMERGENCY', // Emergency pause (higher priority, stricter unpause rules)
};

const PAUSE_REASONS = {
  SCHEDULED_MAINTENANCE: 'SCHEDULED_MAINTENANCE',
  VOLATILITY_CIRCUIT_BREAKER: 'VOLATILITY_CIRCUIT_BREAKER',
  LIQUIDITY_CRISIS: 'LIQUIDITY_CRISIS',
  SECURITY_CONCERN: 'SECURITY_CONCERN',
  REGULATORY_HOLD: 'REGULATORY_HOLD',
  EMERGENCY: 'EMERGENCY',
  MANUAL: 'MANUAL',
};

// Roles allowed to pause/unpause
const PAUSE_PERMISSIONS = {
  PAUSE: ['SUPER_ADMIN', 'MARKET_OPERATOR', 'EMERGENCY_OPERATOR'],
  UNPAUSE: ['SUPER_ADMIN', 'MARKET_OPERATOR'],
  EMERGENCY_PAUSE: ['SUPER_ADMIN', 'EMERGENCY_OPERATOR', 'SECURITY_OFFICER'],
  EMERGENCY_UNPAUSE: ['SUPER_ADMIN'], // Only super admin can lift emergency pauses
};

// ─────────────────────────────────────────────────────────────── State

/**
 * Per-market pause state.
 * Key: marketId (or 'GLOBAL' for system-wide pause)
 * Value: pause state object
 */
const pauseStates = new Map();

/**
 * Pause event log — append-only audit trail.
 */
const pauseEventLog = [];

// ─────────────────────────────────────────────────────────────── Helpers

/**
 * Get or initialize state for a market.
 * @param {string} marketId
 * @returns {object}
 */
function getOrInitMarketState(marketId) {
  if (!pauseStates.has(marketId)) {
    pauseStates.set(marketId, {
      marketId,
      state: PAUSE_STATES.ACTIVE,
      pausedBy: null,
      pausedAt: null,
      unpausedBy: null,
      unpausedAt: null,
      reason: null,
      notes: null,
      totalPauseDurationMs: 0,
      pauseCount: 0,
      emergencyPauseCount: 0,
    });
  }
  return pauseStates.get(marketId);
}

/**
 * Validate operator permission for a given action.
 * @param {string} operatorId
 * @param {string} role
 * @param {string} action - Key in PAUSE_PERMISSIONS
 * @throws {Error}
 */
function validatePermission(operatorId, role, action) {
  if (!operatorId || typeof operatorId !== 'string' || operatorId.trim() === '') {
    throw new Error('Operator ID is required');
  }
  const allowed = PAUSE_PERMISSIONS[action] || [];
  if (!role || !allowed.includes(role)) {
    throw new Error(
      `Role "${role}" is not authorized for action "${action}". Allowed: ${allowed.join(', ')}`
    );
  }
}

/**
 * Append an event to the audit log.
 * @param {string} eventType
 * @param {string} marketId
 * @param {string} operatorId
 * @param {string} role
 * @param {object} [extra]
 */
function logEvent(eventType, marketId, operatorId, role, extra = {}) {
  const event = {
    eventId: `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    eventType,
    marketId,
    operatorId,
    role,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  pauseEventLog.push(event);
  console.log(`[PAUSE] ${eventType} | market=${marketId} | operator=${operatorId} | role=${role}`);
  return event;
}

// ─────────────────────────────────────────────────────────────── Core Operations

/**
 * Pause a market (standard pause).
 *
 * @param {object} params
 * @param {string} params.marketId - Market to pause (use 'GLOBAL' for system-wide)
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} params.reason - From PAUSE_REASONS
 * @param {string} [params.notes]
 * @param {number} [params.durationMs] - Optional auto-unpause duration in ms
 * @returns {Promise<object>}
 */
async function pauseMarket({ marketId, operatorId, role, reason, notes, durationMs }) {
  validatePermission(operatorId, role, 'PAUSE');

  if (!marketId || typeof marketId !== 'string') {
    throw new Error('marketId is required');
  }
  if (!reason || !Object.values(PAUSE_REASONS).includes(reason)) {
    throw new Error(
      `Invalid pause reason. Must be one of: ${Object.values(PAUSE_REASONS).join(', ')}`
    );
  }

  const state = getOrInitMarketState(marketId);

  if (state.state !== PAUSE_STATES.ACTIVE) {
    throw new Error(
      `Market "${marketId}" is already in "${state.state}" state and cannot be paused again`
    );
  }

  state.state = PAUSE_STATES.PAUSED;
  state.pausedBy = operatorId;
  state.pausedAt = new Date().toISOString();
  state.unpausedBy = null;
  state.unpausedAt = null;
  state.reason = reason;
  state.notes = notes || null;
  state.pauseCount += 1;

  const event = logEvent('MARKET_PAUSED', marketId, operatorId, role, {
    reason,
    notes: notes || null,
    durationMs: durationMs || null,
  });

  // Schedule auto-unpause if duration provided
  if (durationMs && durationMs > 0) {
    setTimeout(async () => {
      try {
        const current = pauseStates.get(marketId);
        if (current && current.state === PAUSE_STATES.PAUSED) {
          await unpauseMarket({
            marketId,
            operatorId: 'SYSTEM',
            role: 'MARKET_OPERATOR',
            notes: `Auto-unpause after ${durationMs}ms scheduled duration`,
          });
        }
      } catch (err) {
        console.error(`[PAUSE] Auto-unpause failed for market ${marketId}:`, err.message);
      }
    }, durationMs);
  }

  return {
    success: true,
    marketId,
    state: state.state,
    pausedBy: operatorId,
    pausedAt: state.pausedAt,
    reason,
    notes: state.notes,
    pauseCount: state.pauseCount,
    eventId: event.eventId,
    message: `Market "${marketId}" paused successfully.`,
  };
}

/**
 * Unpause a market (standard unpause).
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.notes]
 * @returns {Promise<object>}
 */
async function unpauseMarket({ marketId, operatorId, role, notes }) {
  validatePermission(operatorId, role, 'UNPAUSE');

  const state = getOrInitMarketState(marketId);

  if (state.state === PAUSE_STATES.ACTIVE) {
    throw new Error(`Market "${marketId}" is already ACTIVE`);
  }

  if (state.state === PAUSE_STATES.EMERGENCY) {
    throw new Error(
      `Market "${marketId}" is under EMERGENCY pause. Use emergency unpause endpoint.`
    );
  }

  // Calculate pause duration
  const pauseDurationMs = state.pausedAt
    ? Date.now() - new Date(state.pausedAt).getTime()
    : 0;

  state.state = PAUSE_STATES.ACTIVE;
  state.unpausedBy = operatorId;
  state.unpausedAt = new Date().toISOString();
  state.totalPauseDurationMs += pauseDurationMs;

  const event = logEvent('MARKET_UNPAUSED', marketId, operatorId, role, {
    pauseDurationMs,
    notes: notes || null,
  });

  return {
    success: true,
    marketId,
    state: state.state,
    unpausedBy: operatorId,
    unpausedAt: state.unpausedAt,
    pauseDurationMs,
    totalPauseDurationMs: state.totalPauseDurationMs,
    eventId: event.eventId,
    message: `Market "${marketId}" unpaused successfully.`,
  };
}

/**
 * Trigger an emergency pause (highest priority, stricter unpause rules).
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.notes]
 * @returns {Promise<object>}
 */
async function emergencyPause({ marketId, operatorId, role, notes }) {
  validatePermission(operatorId, role, 'EMERGENCY_PAUSE');

  if (!marketId || typeof marketId !== 'string') {
    throw new Error('marketId is required');
  }

  const state = getOrInitMarketState(marketId);

  if (state.state === PAUSE_STATES.EMERGENCY) {
    throw new Error(`Market "${marketId}" is already under EMERGENCY pause`);
  }

  state.state = PAUSE_STATES.EMERGENCY;
  state.pausedBy = operatorId;
  state.pausedAt = new Date().toISOString();
  state.unpausedBy = null;
  state.unpausedAt = null;
  state.reason = PAUSE_REASONS.EMERGENCY;
  state.notes = notes || null;
  state.pauseCount += 1;
  state.emergencyPauseCount += 1;

  const event = logEvent('EMERGENCY_PAUSE', marketId, operatorId, role, {
    notes: notes || null,
  });

  console.warn(
    `[PAUSE] EMERGENCY PAUSE activated for market "${marketId}" by ${operatorId} (${role})`
  );

  return {
    success: true,
    marketId,
    state: state.state,
    pausedBy: operatorId,
    pausedAt: state.pausedAt,
    emergencyPauseCount: state.emergencyPauseCount,
    eventId: event.eventId,
    message: `EMERGENCY pause activated for market "${marketId}". Only SUPER_ADMIN can lift this.`,
  };
}

/**
 * Lift an emergency pause (SUPER_ADMIN only).
 *
 * @param {object} params
 * @param {string} params.marketId
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.notes]
 * @returns {Promise<object>}
 */
async function emergencyUnpause({ marketId, operatorId, role, notes }) {
  validatePermission(operatorId, role, 'EMERGENCY_UNPAUSE');

  const state = getOrInitMarketState(marketId);

  if (state.state !== PAUSE_STATES.EMERGENCY) {
    throw new Error(
      `Market "${marketId}" is not under EMERGENCY pause (current state: ${state.state})`
    );
  }

  const pauseDurationMs = state.pausedAt
    ? Date.now() - new Date(state.pausedAt).getTime()
    : 0;

  state.state = PAUSE_STATES.ACTIVE;
  state.unpausedBy = operatorId;
  state.unpausedAt = new Date().toISOString();
  state.totalPauseDurationMs += pauseDurationMs;

  const event = logEvent('EMERGENCY_UNPAUSE', marketId, operatorId, role, {
    pauseDurationMs,
    notes: notes || null,
  });

  console.log(
    `[PAUSE] Emergency pause lifted for market "${marketId}" by ${operatorId}. Duration: ${pauseDurationMs}ms`
  );

  return {
    success: true,
    marketId,
    state: state.state,
    unpausedBy: operatorId,
    unpausedAt: state.unpausedAt,
    pauseDurationMs,
    eventId: event.eventId,
    message: `Emergency pause lifted for market "${marketId}". Market is now ACTIVE.`,
  };
}

/**
 * Get pause status for a specific market.
 *
 * @param {string} marketId
 * @returns {object}
 */
function getPauseStatus(marketId) {
  const state = getOrInitMarketState(marketId);

  const currentPauseDurationMs =
    state.state !== PAUSE_STATES.ACTIVE && state.pausedAt
      ? Date.now() - new Date(state.pausedAt).getTime()
      : 0;

  return {
    success: true,
    data: {
      marketId: state.marketId,
      state: state.state,
      isActive: state.state === PAUSE_STATES.ACTIVE,
      isPaused: state.state === PAUSE_STATES.PAUSED,
      isEmergency: state.state === PAUSE_STATES.EMERGENCY,
      pausedBy: state.pausedBy,
      pausedAt: state.pausedAt,
      unpausedBy: state.unpausedBy,
      unpausedAt: state.unpausedAt,
      reason: state.reason,
      notes: state.notes,
      currentPauseDurationMs,
      totalPauseDurationMs: state.totalPauseDurationMs,
      pauseCount: state.pauseCount,
      emergencyPauseCount: state.emergencyPauseCount,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Get pause status for all tracked markets.
 * @returns {object}
 */
function getAllPauseStatuses() {
  const statuses = [];
  for (const [marketId] of pauseStates) {
    statuses.push(getPauseStatus(marketId).data);
  }

  return {
    success: true,
    data: {
      markets: statuses,
      totalMarkets: statuses.length,
      pausedCount: statuses.filter((s) => s.isPaused || s.isEmergency).length,
      emergencyCount: statuses.filter((s) => s.isEmergency).length,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Get the pause event log, optionally filtered by marketId.
 *
 * @param {object} [filters]
 * @param {string} [filters.marketId]
 * @param {string} [filters.eventType]
 * @param {number} [filters.limit]
 * @returns {object}
 */
function getPauseEventLog({ marketId, eventType, limit } = {}) {
  let events = [...pauseEventLog];

  if (marketId) {
    events = events.filter((e) => e.marketId === marketId);
  }
  if (eventType) {
    events = events.filter((e) => e.eventType === eventType);
  }

  // Most recent first
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (limit && limit > 0) {
    events = events.slice(0, limit);
  }

  return {
    success: true,
    data: {
      events,
      total: events.length,
    },
  };
}

/**
 * Check if a specific market is currently accepting operations.
 * @param {string} marketId
 * @returns {boolean}
 */
function isMarketActive(marketId) {
  const state = pauseStates.get(marketId);
  if (!state) return true; // Unknown markets default to active
  return state.state === PAUSE_STATES.ACTIVE;
}

// ─────────────────────────────────────────────────────────────── Exports

module.exports = {
  pauseMarket,
  unpauseMarket,
  emergencyPause,
  emergencyUnpause,
  getPauseStatus,
  getAllPauseStatuses,
  getPauseEventLog,
  isMarketActive,
  PAUSE_STATES,
  PAUSE_REASONS,
  PAUSE_PERMISSIONS,
};
