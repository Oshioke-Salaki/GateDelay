const express = require('express');
const insuranceService = require('../services/insuranceService');

const router = express.Router();

// ─── Shared Middleware ────────────────────────────────────────────────────────

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Insurance Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'INSURANCE_ERROR' });
  }
};

const validateRequest = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  next();
};

const requireUserId = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.body.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  req.userId = userId;
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /insurance/quote
 * Generate an insurance premium quote (no persistence).
 *
 * Body: { tier, coverageAmount, durationDays, asset }
 */
router.post(
  '/quote',
  validateRequest(['tier', 'coverageAmount', 'durationDays', 'asset']),
  handleErrors((req, res) => {
    const result = insuranceService.generateQuote({
      tier:           req.body.tier.toUpperCase(),
      coverageAmount: req.body.coverageAmount,
      durationDays:   Number(req.body.durationDays),
      asset:          req.body.asset,
    });
    res.status(200).json(result);
  })
);

/**
 * POST /insurance/purchase
 * Purchase an insurance policy.
 *
 * Body: { marketId, tier, coverageAmount, durationDays, asset, txHash? }
 * Headers: x-user-id
 */
router.post(
  '/purchase',
  requireUserId,
  validateRequest(['marketId', 'tier', 'coverageAmount', 'durationDays', 'asset']),
  handleErrors(async (req, res) => {
    const result = await insuranceService.purchaseInsurance({
      userId:         req.userId,
      marketId:       req.body.marketId,
      tier:           req.body.tier.toUpperCase(),
      coverageAmount: req.body.coverageAmount,
      durationDays:   Number(req.body.durationDays),
      asset:          req.body.asset,
      txHash:         req.body.txHash,
    });
    res.status(201).json(result);
  })
);

/**
 * GET /insurance/policies
 * Get all policies for the authenticated user.
 *
 * Query: ?status=ACTIVE|EXPIRED|CANCELLED|CLAIMED
 * Headers: x-user-id
 */
router.get(
  '/policies',
  requireUserId,
  handleErrors(async (req, res) => {
    const result = await insuranceService.getUserPolicies(
      req.userId,
      req.query.status ? req.query.status.toUpperCase() : null
    );
    res.status(200).json(result);
  })
);

/**
 * GET /insurance/policies/:policyId/status
 * Get coverage status and remaining limits for a policy.
 */
router.get(
  '/policies/:policyId/status',
  handleErrors(async (req, res) => {
    const result = await insuranceService.getCoverageStatus(req.params.policyId);
    res.status(200).json(result);
  })
);

/**
 * PATCH /insurance/policies/:policyId/cancel
 * Cancel an active policy.
 *
 * Body: { reason }
 * Headers: x-user-id
 */
router.patch(
  '/policies/:policyId/cancel',
  requireUserId,
  validateRequest(['reason']),
  handleErrors(async (req, res) => {
    const result = await insuranceService.cancelPolicy(
      req.params.policyId,
      req.userId,
      req.body.reason
    );
    res.status(200).json(result);
  })
);

/**
 * GET /insurance/tiers
 * Return available coverage tiers and their parameters.
 */
router.get('/tiers', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      tiers: insuranceService.COVERAGE_TIERS,
      allowedDurations: insuranceService.COVERAGE_DURATION_DAYS,
    },
  });
});

module.exports = router;
