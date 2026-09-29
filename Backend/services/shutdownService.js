/**
 * SHUTDOWN SERVICE
 * Manages emergency market shutdown procedures including authorization,
 * pending operation cancellation, status tracking, and recovery.
 *
 * Dependencies: web3.js, mongoose
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');

// ─────────────────────────────────────────────────────────────── Constants

const SHUTDOWN_STATES = {
  OPERATIONAL: 'OPERATIONAL',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  SHUTDOWN: 'SHUTDOWN',
  RECOVERING: 'RECOVERING',
};

const SHUTDOWN_REASONS = {
  SECURITY_BREACH: 'SECURITY_BREACH',
  MARKET_MANIPULATION: 'MARKET_MANIPULATION',
  TECHNICAL_FAILURE: 'TECHNICAL_FAILURE',
  REGULATORY: 'REGULATORY',
  MAINTENANCE: 'MAINTENANCE',
  MANUAL: 'MANUAL',
};

const AUTHORIZED_ROLES = ['SUPER_ADMIN', 'EMERGENCY_OPERATOR', 'SECURITY_OFFICER'];

// ─────────────────────────────────────────────────────────────── State

/**
 * In-memory shutdown state.
 * In production this would be persisted to Redis/DB for multi-instance coordination.
 */
let shutdownState = {
  status: SHUTDOWN_STATES.OPERATIONAL,
  reason: null,
  initiatedBy: null,
  initiatedAt: null,
  completedAt: null,
  recoveryStartedAt: null,
  recoveryCompletedAt: null,
  cancelledOrderCount: 0,
  shutdownId: null,
  notes: null,
  history: [],
};

// ─────────────────────────────────────────────────────────────── Helpers

/**
 * Generate a unique shutdown ID.
 * @returns {string}
 */
function generateShutdownId() {
  return `SHUTDOWN_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

/**
 * Validate that the operator is authorized to trigger emergency actions.
 * @param {string} operatorId
 * @param {string} role
 * @throws {Error} if not authorized
 */
function validateAuthorization(operatorId, role) {
  if (!operatorId || typeof operatorId !== 'string' || operatorId.trim() === '') {
    throw new Error('Operator ID is required for emergency operations');
  }
  if (!role || !AUTHORIZED_ROLES.includes(role)) {
    throw new Error(
      `Unauthorized role "${role}". Must be one of: ${AUTHORIZED_ROLES.join(', ')}`
    );
  }
}

/**
 * Record a state transition in the audit history.
 * @param {string} fromState
 * @param {string} toState
 * @param {string} operatorId
 * @param {string} [notes]
 */
function recordTransition(fromState, toState, operatorId, notes) {
  shutdownState.history.push({
    fromState,
    toState,
    operatorId,
    notes: notes || null,
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────── Core Operations

/**
 * Trigger an emergency market shutdown.
 * Cancels all pending/partial orders and halts new order processing.
 *
 * @param {object} params
 * @param {string} params.operatorId - ID of the operator initiating shutdown
 * @param {string} params.role - Operator role (must be in AUTHORIZED_ROLES)
 * @param {string} params.reason - Reason code from SHUTDOWN_REASONS
 * @param {string} [params.notes] - Optional free-text notes
 * @returns {Promise<object>} Shutdown result with cancelled order count
 * @throws {Error} If already shut down or unauthorized
 */
async function initiateEmergencyShutdown({ operatorId, role, reason, notes }) {
  validateAuthorization(operatorId, role);

  if (!reason || !Object.values(SHUTDOWN_REASONS).includes(reason)) {
    throw new Error(
      `Invalid shutdown reason. Must be one of: ${Object.values(SHUTDOWN_REASONS).join(', ')}`
    );
  }

  if (shutdownState.status !== SHUTDOWN_STATES.OPERATIONAL) {
    throw new Error(
      `Cannot initiate shutdown: market is currently in "${shutdownState.status}" state`
    );
  }

  const previousState = shutdownState.status;
  const shutdownId = generateShutdownId();

  // Transition to SHUTTING_DOWN immediately
  shutdownState.status = SHUTDOWN_STATES.SHUTTING_DOWN;
  shutdownState.reason = reason;
  shutdownState.initiatedBy = operatorId;
  shutdownState.initiatedAt = new Date().toISOString();
  shutdownState.shutdownId = shutdownId;
  shutdownState.notes = notes || null;
  shutdownState.cancelledOrderCount = 0;

  recordTransition(previousState, SHUTDOWN_STATES.SHUTTING_DOWN, operatorId, notes);

  console.warn(
    `[SHUTDOWN] Emergency shutdown initiated by ${operatorId} (${role}). Reason: ${reason}. ID: ${shutdownId}`
  );

  // Cancel all pending and partial orders
  let cancelledCount = 0;
  try {
    const result = await Order.updateMany(
      { status: { $in: ['Pending', 'Partial'] } },
      {
        $set: {
          status: 'Canceled',
          cancelReason: `Emergency shutdown: ${reason}`,
          cancelledAt: new Date(),
        },
      }
    );
    cancelledCount = result.modifiedCount || 0;
  } catch (dbError) {
    console.error('[SHUTDOWN] Failed to cancel orders during shutdown:', dbError.message);
    // Continue shutdown even if order cancellation partially fails
  }

  shutdownState.cancelledOrderCount = cancelledCount;
  shutdownState.status = SHUTDOWN_STATES.SHUTDOWN;
  shutdownState.completedAt = new Date().toISOString();

  recordTransition(SHUTDOWN_STATES.SHUTTING_DOWN, SHUTDOWN_STATES.SHUTDOWN, operatorId);

  console.warn(
    `[SHUTDOWN] Shutdown complete. Cancelled ${cancelledCount} orders. ID: ${shutdownId}`
  );

  return {
    success: true,
    shutdownId,
    status: shutdownState.status,
    reason,
    initiatedBy: operatorId,
    initiatedAt: shutdownState.initiatedAt,
    completedAt: shutdownState.completedAt,
    cancelledOrderCount: cancelledCount,
    message: `Emergency shutdown completed. ${cancelledCount} pending orders cancelled.`,
  };
}

/**
 * Cancel all pending operations without full shutdown (partial emergency action).
 *
 * @param {object} params
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.pair] - Optional: limit cancellation to a specific trading pair
 * @returns {Promise<object>}
 */
async function cancelPendingOperations({ operatorId, role, pair }) {
  validateAuthorization(operatorId, role);

  const filter = { status: { $in: ['Pending', 'Partial'] } };
  if (pair) {
    filter.pair = pair;
  }

  const result = await Order.updateMany(filter, {
    $set: {
      status: 'Canceled',
      cancelReason: `Emergency cancellation by ${operatorId}`,
      cancelledAt: new Date(),
    },
  });

  const cancelledCount = result.modifiedCount || 0;

  console.warn(
    `[SHUTDOWN] Emergency cancellation by ${operatorId}: ${cancelledCount} orders cancelled${pair ? ` for pair ${pair}` : ''}`
  );

  return {
    success: true,
    cancelledOrderCount: cancelledCount,
    pair: pair || 'ALL',
    cancelledBy: operatorId,
    timestamp: new Date().toISOString(),
    message: `${cancelledCount} pending operations cancelled successfully.`,
  };
}

/**
 * Initiate market recovery after a shutdown.
 * Transitions state from SHUTDOWN → RECOVERING → OPERATIONAL.
 *
 * @param {object} params
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.notes] - Recovery notes / checklist confirmation
 * @returns {Promise<object>}
 */
async function initiateRecovery({ operatorId, role, notes }) {
  validateAuthorization(operatorId, role);

  if (shutdownState.status !== SHUTDOWN_STATES.SHUTDOWN) {
    throw new Error(
      `Cannot initiate recovery: market is in "${shutdownState.status}" state. Must be SHUTDOWN.`
    );
  }

  const previousState = shutdownState.status;

  shutdownState.status = SHUTDOWN_STATES.RECOVERING;
  shutdownState.recoveryStartedAt = new Date().toISOString();

  recordTransition(previousState, SHUTDOWN_STATES.RECOVERING, operatorId, notes);

  console.log(`[SHUTDOWN] Recovery initiated by ${operatorId}. Notes: ${notes || 'none'}`);

  return {
    success: true,
    status: shutdownState.status,
    recoveryStartedAt: shutdownState.recoveryStartedAt,
    initiatedBy: operatorId,
    message: 'Recovery process initiated. Market is in RECOVERING state.',
  };
}

/**
 * Complete recovery and return market to OPERATIONAL state.
 *
 * @param {object} params
 * @param {string} params.operatorId
 * @param {string} params.role
 * @param {string} [params.notes]
 * @returns {Promise<object>}
 */
async function completeRecovery({ operatorId, role, notes }) {
  validateAuthorization(operatorId, role);

  if (shutdownState.status !== SHUTDOWN_STATES.RECOVERING) {
    throw new Error(
      `Cannot complete recovery: market is in "${shutdownState.status}" state. Must be RECOVERING.`
    );
  }

  const previousState = shutdownState.status;

  shutdownState.status = SHUTDOWN_STATES.OPERATIONAL;
  shutdownState.recoveryCompletedAt = new Date().toISOString();

  recordTransition(previousState, SHUTDOWN_STATES.OPERATIONAL, operatorId, notes);

  console.log(`[SHUTDOWN] Recovery completed by ${operatorId}. Market is OPERATIONAL.`);

  return {
    success: true,
    status: shutdownState.status,
    recoveryCompletedAt: shutdownState.recoveryCompletedAt,
    completedBy: operatorId,
    message: 'Recovery complete. Market is now OPERATIONAL.',
  };
}

/**
 * Get the current shutdown status.
 * @returns {object}
 */
function getShutdownStatus() {
  return {
    success: true,
    data: {
      status: shutdownState.status,
      isOperational: shutdownState.status === SHUTDOWN_STATES.OPERATIONAL,
      isShutdown: shutdownState.status === SHUTDOWN_STATES.SHUTDOWN,
      shutdownId: shutdownState.shutdownId,
      reason: shutdownState.reason,
      initiatedBy: shutdownState.initiatedBy,
      initiatedAt: shutdownState.initiatedAt,
      completedAt: shutdownState.completedAt,
      recoveryStartedAt: shutdownState.recoveryStartedAt,
      recoveryCompletedAt: shutdownState.recoveryCompletedAt,
      cancelledOrderCount: shutdownState.cancelledOrderCount,
      notes: shutdownState.notes,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Get the full shutdown audit history.
 * @returns {object}
 */
function getShutdownHistory() {
  return {
    success: true,
    data: {
      currentStatus: shutdownState.status,
      history: [...shutdownState.history],
      totalTransitions: shutdownState.history.length,
    },
  };
}

/**
 * Check if the market is currently accepting operations.
 * Used by other services as a gate check.
 * @returns {boolean}
 */
function isMarketOperational() {
  return shutdownState.status === SHUTDOWN_STATES.OPERATIONAL;
}

// ─────────────────────────────────────────────────────────────── Exports

module.exports = {
  initiateEmergencyShutdown,
  cancelPendingOperations,
  initiateRecovery,
  completeRecovery,
  getShutdownStatus,
  getShutdownHistory,
  isMarketOperational,
  SHUTDOWN_STATES,
  SHUTDOWN_REASONS,
  AUTHORIZED_ROLES,
};
