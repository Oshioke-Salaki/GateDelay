/**
 * SHUTDOWN ROUTES
 * API endpoints for emergency market shutdown procedures.
 *
 * All mutating endpoints require operator authorization via headers:
 *   x-operator-id: <operatorId>
 *   x-operator-role: <SUPER_ADMIN | EMERGENCY_OPERATOR | SECURITY_OFFICER>
 */

const express = require('express');
const shutdownService = require('../services/shutdownService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────── Middleware

/**
 * Wrap async route handlers and normalize errors.
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Shutdown Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'SHUTDOWN_ERROR',
    });
  }
};

/**
 * Enforce operator authorization headers.
 * Attaches operatorId and role to req for downstream use.
 */
const requireOperator = (req, res, next) => {
  const operatorId = req.headers['x-operator-id'];
  const role = req.headers['x-operator-role'];

  if (!operatorId) {
    return res.status(401).json({
      success: false,
      error: 'Missing x-operator-id header',
      code: 'UNAUTHORIZED',
    });
  }

  if (!role) {
    return res.status(403).json({
      success: false,
      error: 'Missing x-operator-role header',
      code: 'FORBIDDEN',
    });
  }

  req.operatorId = operatorId;
  req.operatorRole = role;
  next();
};

// ─────────────────────────────────────────────────────────────── Routes

/**
 * GET /shutdown/status
 * Returns the current market shutdown status.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "OPERATIONAL" | "SHUTTING_DOWN" | "SHUTDOWN" | "RECOVERING",
 *     "isOperational": boolean,
 *     "isShutdown": boolean,
 *     "shutdownId": string | null,
 *     "reason": string | null,
 *     "initiatedBy": string | null,
 *     "initiatedAt": string | null,
 *     "completedAt": string | null,
 *     "cancelledOrderCount": number,
 *     "timestamp": string
 *   }
 * }
 */
router.get(
  '/status',
  handleErrors(async (req, res) => {
    const result = shutdownService.getShutdownStatus();
    res.status(200).json(result);
  })
);

/**
 * GET /shutdown/history
 * Returns the full audit trail of shutdown state transitions.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "currentStatus": string,
 *     "history": [ { fromState, toState, operatorId, notes, timestamp } ],
 *     "totalTransitions": number
 *   }
 * }
 */
router.get(
  '/history',
  handleErrors(async (req, res) => {
    const result = shutdownService.getShutdownHistory();
    res.status(200).json(result);
  })
);

/**
 * POST /shutdown/emergency
 * Trigger an immediate emergency market shutdown.
 * Cancels all pending/partial orders and halts new order processing.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <SUPER_ADMIN | EMERGENCY_OPERATOR | SECURITY_OFFICER>
 *
 * Request body:
 * {
 *   "reason": "SECURITY_BREACH" | "MARKET_MANIPULATION" | "TECHNICAL_FAILURE" | "REGULATORY" | "MAINTENANCE" | "MANUAL",
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "shutdownId": string,
 *   "status": "SHUTDOWN",
 *   "cancelledOrderCount": number,
 *   "message": string
 * }
 */
router.post(
  '/emergency',
  requireOperator,
  handleErrors(async (req, res) => {
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: reason',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await shutdownService.initiateEmergencyShutdown({
      operatorId: req.operatorId,
      role: req.operatorRole,
      reason,
      notes,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /shutdown/cancel-pending
 * Cancel all pending operations without triggering a full shutdown.
 * Optionally scoped to a specific trading pair.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <string>
 *
 * Request body:
 * {
 *   "pair": "string (optional) — e.g. BTC-USDT"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "cancelledOrderCount": number,
 *   "pair": string,
 *   "timestamp": string
 * }
 */
router.post(
  '/cancel-pending',
  requireOperator,
  handleErrors(async (req, res) => {
    const { pair } = req.body;

    const result = await shutdownService.cancelPendingOperations({
      operatorId: req.operatorId,
      role: req.operatorRole,
      pair: pair || null,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /shutdown/recover
 * Begin the recovery process after a shutdown.
 * Transitions market from SHUTDOWN → RECOVERING.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <string>
 *
 * Request body:
 * {
 *   "notes": "string (optional) — recovery checklist / confirmation notes"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "status": "RECOVERING",
 *   "recoveryStartedAt": string
 * }
 */
router.post(
  '/recover',
  requireOperator,
  handleErrors(async (req, res) => {
    const { notes } = req.body;

    const result = await shutdownService.initiateRecovery({
      operatorId: req.operatorId,
      role: req.operatorRole,
      notes,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /shutdown/recover/complete
 * Complete recovery and return market to OPERATIONAL state.
 * Transitions market from RECOVERING → OPERATIONAL.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <string>
 *
 * Request body:
 * {
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "status": "OPERATIONAL",
 *   "recoveryCompletedAt": string
 * }
 */
router.post(
  '/recover/complete',
  requireOperator,
  handleErrors(async (req, res) => {
    const { notes } = req.body;

    const result = await shutdownService.completeRecovery({
      operatorId: req.operatorId,
      role: req.operatorRole,
      notes,
    });

    res.status(200).json(result);
  })
);

module.exports = router;
