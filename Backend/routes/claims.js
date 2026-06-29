const express = require('express');
const claimService = require('../services/claimService');

const router = express.Router();

// ─── Shared Middleware ────────────────────────────────────────────────────────

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Claims Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'CLAIM_ERROR' });
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

const requireAdmin = (req, res, next) => {
  const adminId = req.headers['x-admin-id'] || req.body.adminId;
  if (!adminId) {
    return res.status(403).json({ success: false, error: 'Admin authorization required', code: 'FORBIDDEN' });
  }
  req.adminId = adminId;
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /claims
 * Submit a new insurance claim.
 *
 * Body: { policyId, claimAmount, description, documents?: [{url, docType, content?}] }
 * Headers: x-user-id
 */
router.post(
  '/',
  requireUserId,
  validateRequest(['policyId', 'claimAmount', 'description']),
  handleErrors(async (req, res) => {
    const result = await claimService.submitClaim({
      policyId:    req.body.policyId,
      userId:      req.userId,
      claimAmount: req.body.claimAmount,
      description: req.body.description,
      documents:   req.body.documents || [],
    });
    res.status(201).json(result);
  })
);

/**
 * GET /claims
 * Get all claims for the authenticated user.
 *
 * Query: ?status=SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED|DISBURSED
 * Headers: x-user-id
 */
router.get(
  '/',
  requireUserId,
  handleErrors(async (req, res) => {
    const result = await claimService.getUserClaims(
      req.userId,
      req.query.status ? req.query.status.toUpperCase() : null
    );
    res.status(200).json(result);
  })
);

/**
 * GET /claims/:claimId
 * Get a single claim by ID.
 */
router.get(
  '/:claimId',
  handleErrors(async (req, res) => {
    const result = await claimService.getClaim(req.params.claimId);
    res.status(200).json(result);
  })
);

/**
 * GET /claims/:claimId/eligibility
 * Check eligibility for a claim before submitting.
 *
 * Query: ?policyId=...&claimAmount=...
 * Headers: x-user-id
 */
router.get(
  '/eligibility/check',
  requireUserId,
  handleErrors(async (req, res) => {
    const { policyId, claimAmount } = req.query;
    if (!policyId || !claimAmount) {
      return res.status(400).json({
        success: false,
        error: 'policyId and claimAmount query params are required',
        code: 'VALIDATION_ERROR',
      });
    }
    const result = await claimService.validateEligibility(policyId, req.userId, claimAmount);
    res.status(200).json({ success: true, data: result });
  })
);

/**
 * POST /claims/:claimId/documents
 * Add a document to an existing claim.
 *
 * Body: { url, docType, content? }
 * Headers: x-user-id
 */
router.post(
  '/:claimId/documents',
  requireUserId,
  validateRequest(['url', 'docType']),
  handleErrors(async (req, res) => {
    const result = await claimService.addDocument(
      req.params.claimId,
      req.userId,
      { url: req.body.url, docType: req.body.docType, content: req.body.content }
    );
    res.status(200).json(result);
  })
);

/**
 * PATCH /claims/:claimId/review
 * Move claim to UNDER_REVIEW (admin only).
 *
 * Body: { notes? }
 * Headers: x-admin-id
 */
router.patch(
  '/:claimId/review',
  requireAdmin,
  handleErrors(async (req, res) => {
    const result = await claimService.startReview(
      req.params.claimId,
      req.adminId,
      req.body.notes
    );
    res.status(200).json(result);
  })
);

/**
 * GET /claims/:claimId/payout
 * Calculate the payout for an approved claim (admin preview).
 *
 * Query: ?override=<amount>
 * Headers: x-admin-id
 */
router.get(
  '/:claimId/payout',
  requireAdmin,
  handleErrors(async (req, res) => {
    const result = await claimService.calculatePayout(
      req.params.claimId,
      req.query.override || null
    );
    res.status(200).json({ success: true, data: result });
  })
);

/**
 * PATCH /claims/:claimId/approve
 * Approve a claim and set payout (admin only).
 *
 * Body: { payoutOverride? }
 * Headers: x-admin-id
 */
router.patch(
  '/:claimId/approve',
  requireAdmin,
  handleErrors(async (req, res) => {
    const result = await claimService.approveClaim(
      req.params.claimId,
      req.adminId,
      req.body.payoutOverride || null
    );
    res.status(200).json(result);
  })
);

/**
 * PATCH /claims/:claimId/reject
 * Reject a claim (admin only).
 *
 * Body: { rejectionReason, notes? }
 * Headers: x-admin-id
 */
router.patch(
  '/:claimId/reject',
  requireAdmin,
  validateRequest(['rejectionReason']),
  handleErrors(async (req, res) => {
    const result = await claimService.rejectClaim(
      req.params.claimId,
      req.adminId,
      req.body.rejectionReason.toUpperCase(),
      req.body.notes
    );
    res.status(200).json(result);
  })
);

/**
 * PATCH /claims/:claimId/disburse
 * Mark claim as disbursed after on-chain transfer (admin only).
 *
 * Body: { txHash }
 * Headers: x-admin-id
 */
router.patch(
  '/:claimId/disburse',
  requireAdmin,
  validateRequest(['txHash']),
  handleErrors(async (req, res) => {
    const result = await claimService.disburseClaim(
      req.params.claimId,
      req.adminId,
      req.body.txHash
    );
    res.status(200).json(result);
  })
);

module.exports = router;
