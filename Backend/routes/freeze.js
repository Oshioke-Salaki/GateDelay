const express = require('express');
const freezeService = require('../services/freezeService');

const router = express.Router();

// ─── Shared Middleware ────────────────────────────────────────────────────────

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Freeze Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'FREEZE_ERROR' });
  }
};

const validateRequest = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => !req.body[f]);
  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  next();
};

/** Require ADMIN or MODERATOR role via header */
const requireFreezePermission = (req, res, next) => {
  const actorId   = req.headers['x-actor-id']   || req.body.actorId;
  const actorRole = req.headers['x-actor-role']  || req.body.actorRole;

  const allowed = Object.values(freezeService.FREEZE_PERMISSIONS);
  if (!actorId || !actorRole || !allowed.includes(actorRole)) {
    return res.status(403).json({
      success: false,
      error: `Freeze permission required. Role must be one of: ${allowed.join(', ')}`,
      code: 'FORBIDDEN',
    });
  }

  req.actorId   = actorId;
  req.actorRole = actorRole;
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /freeze
 * Freeze all or selected operations for a market.
 *
 * Body: { marketId, reason, functions?, disputeId?, durationMs? }
 * Headers: x-actor-id, x-actor-role
 */
router.post(
  '/',
  requireFreezePermission,
  validateRequest(['marketId', 'reason']),
  handleErrors(async (req, res) => {
    const result = await freezeService.freezeMarket({
      marketId:   req.body.marketId,
      frozenBy:   req.actorId,
      frozenByRole: req.actorRole,
      reason:     req.body.reason,
      functions:  req.body.functions,   // optional; defaults to all
      disputeId:  req.body.disputeId,
      durationMs: req.body.durationMs,
    });
    res.status(201).json(result);
  })
);

/**
 * PATCH /freeze/:freezeId/lift
 * Lift an active freeze.
 *
 * Body: { liftReason }
 * Headers: x-actor-id, x-actor-role
 */
router.patch(
  '/:freezeId/lift',
  requireFreezePermission,
  validateRequest(['liftReason']),
  handleErrors(async (req, res) => {
    const result = await freezeService.liftFreeze({
      freezeId:     req.params.freezeId,
      liftedBy:     req.actorId,
      liftedByRole: req.actorRole,
      liftReason:   req.body.liftReason,
    });
    res.status(200).json(result);
  })
);

/**
 * GET /freeze/:marketId/active
 * Get all active freezes for a market.
 */
router.get(
  '/:marketId/active',
  handleErrors(async (req, res) => {
    const result = await freezeService.getActiveFreezes(req.params.marketId);
    res.status(200).json(result);
  })
);

/**
 * GET /freeze/:marketId/history
 * Get full freeze history for a market.
 */
router.get(
  '/:marketId/history',
  handleErrors(async (req, res) => {
    const result = await freezeService.getFreezeHistory(req.params.marketId);
    res.status(200).json(result);
  })
);

/**
 * GET /freeze/:marketId/check/:fn
 * Check if a specific function is currently frozen for a market.
 * Returns { frozen: boolean }
 */
router.get(
  '/:marketId/check/:fn',
  handleErrors(async (req, res) => {
    const frozen = await freezeService.isFunctionFrozen(
      req.params.marketId,
      req.params.fn.toUpperCase()
    );
    res.status(200).json({ success: true, data: { frozen } });
  })
);

module.exports = router;
