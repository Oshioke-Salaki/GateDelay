/**
 * PAUSE ROUTES
 * API endpoints for pausing and unpausing market operations.
 *
 * Authorization headers required for mutating endpoints:
 *   x-operator-id: <operatorId>
 *   x-operator-role: <role>
 */

const express = require('express');
const pauseService = require('../services/pauseService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────── Middleware

/**
 * Wrap async route handlers and normalize errors.
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Pause Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'PAUSE_ERROR',
    });
  }
};

/**
 * Enforce operator authorization headers.
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
 * GET /pause/status
 * Get pause status for all tracked markets.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "markets": [ { marketId, state, isPaused, isEmergency, ... } ],
 *     "totalMarkets": number,
 *     "pausedCount": number,
 *     "emergencyCount": number
 *   }
 * }
 */
router.get(
  '/status',
  handleErrors(async (req, res) => {
    const result = pauseService.getAllPauseStatuses();
    res.status(200).json(result);
  })
);

/**
 * GET /pause/status/:marketId
 * Get pause status for a specific market.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "marketId": string,
 *     "state": "ACTIVE" | "PAUSED" | "EMERGENCY",
 *     "isActive": boolean,
 *     "isPaused": boolean,
 *     "isEmergency": boolean,
 *     "pausedBy": string | null,
 *     "pausedAt": string | null,
 *     "currentPauseDurationMs": number,
 *     "totalPauseDurationMs": number,
 *     "pauseCount": number
 *   }
 * }
 */
router.get(
  '/status/:marketId',
  handleErrors(async (req, res) => {
    const result = pauseService.getPauseStatus(req.params.marketId);
    res.status(200).json(result);
  })
);

/**
 * GET /pause/events
 * Get the pause event log.
 *
 * Query params:
 *   marketId (optional) — filter by market
 *   eventType (optional) — filter by event type
 *   limit (optional) — max number of events to return
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "events": [ { eventId, eventType, marketId, operatorId, role, timestamp, ... } ],
 *     "total": number
 *   }
 * }
 */
router.get(
  '/events',
  handleErrors(async (req, res) => {
    const { marketId, eventType, limit } = req.query;
    const result = pauseService.getPauseEventLog({
      marketId,
      eventType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  })
);

/**
 * POST /pause/:marketId
 * Pause a specific market.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <SUPER_ADMIN | MARKET_OPERATOR | EMERGENCY_OPERATOR>
 *
 * Request body:
 * {
 *   "reason": "SCHEDULED_MAINTENANCE" | "VOLATILITY_CIRCUIT_BREAKER" | "LIQUIDITY_CRISIS" | "SECURITY_CONCERN" | "REGULATORY_HOLD" | "EMERGENCY" | "MANUAL",
 *   "notes": "string (optional)",
 *   "durationMs": number (optional — auto-unpause after this many milliseconds)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "marketId": string,
 *   "state": "PAUSED",
 *   "pausedBy": string,
 *   "pausedAt": string,
 *   "reason": string,
 *   "pauseCount": number,
 *   "eventId": string
 * }
 */
router.post(
  '/:marketId',
  requireOperator,
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { reason, notes, durationMs } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: reason',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await pauseService.pauseMarket({
      marketId,
      operatorId: req.operatorId,
      role: req.operatorRole,
      reason,
      notes,
      durationMs: durationMs ? Number(durationMs) : undefined,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /pause/:marketId/unpause
 * Unpause a specific market (standard unpause).
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <SUPER_ADMIN | MARKET_OPERATOR>
 *
 * Request body:
 * {
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "marketId": string,
 *   "state": "ACTIVE",
 *   "unpausedBy": string,
 *   "unpausedAt": string,
 *   "pauseDurationMs": number
 * }
 */
router.post(
  '/:marketId/unpause',
  requireOperator,
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { notes } = req.body;

    const result = await pauseService.unpauseMarket({
      marketId,
      operatorId: req.operatorId,
      role: req.operatorRole,
      notes,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /pause/:marketId/emergency
 * Trigger an emergency pause on a market (highest priority).
 * Only SUPER_ADMIN can lift an emergency pause.
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: <SUPER_ADMIN | EMERGENCY_OPERATOR | SECURITY_OFFICER>
 *
 * Request body:
 * {
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "marketId": string,
 *   "state": "EMERGENCY",
 *   "pausedBy": string,
 *   "emergencyPauseCount": number
 * }
 */
router.post(
  '/:marketId/emergency',
  requireOperator,
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { notes } = req.body;

    const result = await pauseService.emergencyPause({
      marketId,
      operatorId: req.operatorId,
      role: req.operatorRole,
      notes,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /pause/:marketId/emergency/lift
 * Lift an emergency pause (SUPER_ADMIN only).
 *
 * Headers:
 *   x-operator-id: <string>
 *   x-operator-role: SUPER_ADMIN
 *
 * Request body:
 * {
 *   "notes": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "marketId": string,
 *   "state": "ACTIVE",
 *   "unpausedBy": string,
 *   "pauseDurationMs": number
 * }
 */
router.post(
  '/:marketId/emergency/lift',
  requireOperator,
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { notes } = req.body;

    const result = await pauseService.emergencyUnpause({
      marketId,
      operatorId: req.operatorId,
      role: req.operatorRole,
      notes,
    });

    res.status(200).json(result);
  })
);

module.exports = router;
