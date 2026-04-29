const express = require('express');
const disputeService = require('../services/disputeService');

const router = express.Router();

/**
 * Error handling middleware
 */
const handleErrors =
  (fn) =>
  async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      console.error('Dispute Route Error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'DISPUTE_ERROR',
      });
    }
  };

/**
 * Middleware for request validation
 */
const validateRequest =
  (requiredFields) =>
  (req, res, next) => {
    const missingFields = requiredFields.filter(
      (field) => !req.body[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
    }

    next();
  };

/**
 * Middleware to enforce admin/moderator role
 * (In production, validate JWT token and check role claims)
 */
const requireAdmin = (req, res, next) => {
  // Extract from header or JWT claims
  const adminId = req.headers['x-admin-id'] || req.body.adminId;

  if (!adminId) {
    return res.status(403).json({
      success: false,
      error: 'Admin authorization required',
      code: 'FORBIDDEN',
    });
  }

  req.adminId = adminId;
  next();
};

/**
 * Middleware to extract and validate user ID
 */
const requireUserId = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  req.userId = userId;
  next();
};

/**
 * POST /disputes
 * Create a new dispute
 *
 * Request body:
 * {
 *   "marketId": "string",
 *   "userId": "string",
 *   "reason": "string",
 *   "description": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { dispute object },
 *   "message": "Dispute created successfully"
 * }
 */
router.post(
  '/',
  requireUserId,
  validateRequest(['marketId', 'reason', 'description']),
  handleErrors(async (req, res) => {
    const result = await disputeService.createDispute({
      marketId: req.body.marketId,
      userId: req.userId,
      reason: req.body.reason,
      description: req.body.description,
    });

    res.status(201).json(result);
  })
);

/**
 * GET /disputes/:id
 * Retrieve a single dispute by ID
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { dispute object }
 * }
 */
router.get(
  '/:id',
  handleErrors(async (req, res) => {
    const result = await disputeService.getDispute(req.params.id);
    res.status(200).json(result);
  })
);

/**
 * GET /disputes/user/:userId/market/:marketId
 * Retrieve most recent dispute for user/market pair
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { dispute object or null }
 * }
 */
router.get(
  '/user/:userId/market/:marketId',
  handleErrors(async (req, res) => {
    const result = await disputeService.getDisputeByUserMarket(
      req.params.userId,
      req.params.marketId
    );
    res.status(200).json(result);
  })
);

/**
 * POST /disputes/:id/evidence
 * Add evidence to a dispute
 *
 * Request body:
 * {
 *   "userId": "string",
 *   "evidence": {
 *     "url": "string (IPFS/CDN URL)",
 *     "description": "string"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { updated dispute object },
 *   "message": "Evidence added successfully"
 * }
 */
router.post(
  '/:id/evidence',
  requireUserId,
  validateRequest(['evidence']),
  handleErrors(async (req, res) => {
    // Validate evidence structure
    const evidence = req.body.evidence;
    if (!evidence.url || !evidence.description) {
      return res.status(400).json({
        success: false,
        error: 'Evidence must include url and description',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await disputeService.addEvidence(
      req.params.id,
      req.userId,
      {
        url: evidence.url,
        description: evidence.description,
      }
    );

    res.status(200).json(result);
  })
);

/**
 * PATCH /disputes/:id/review
 * Move dispute to UNDER_REVIEW status (admin only)
 *
 * Headers:
 * {
 *   "x-admin-id": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { updated dispute object },
 *   "message": "Dispute moved to UNDER_REVIEW"
 * }
 */
router.patch(
  '/:id/review',
  requireAdmin,
  handleErrors(async (req, res) => {
    const result = await disputeService.startReview(req.params.id, req.adminId);
    res.status(200).json(result);
  })
);

/**
 * PATCH /disputes/:id/resolve
 * Resolve a dispute (admin only)
 *
 * Request body:
 * {
 *   "outcome": "USER_WIN" | "ADMIN_WIN" | "SYSTEM_DECISION" | "REJECTED",
 *   "summary": "string",
 *   "txHash": "string (optional - blockchain reference)"
 * }
 *
 * Headers:
 * {
 *   "x-admin-id": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { resolved dispute object },
 *   "message": "Dispute resolved successfully"
 * }
 */
router.patch(
  '/:id/resolve',
  requireAdmin,
  validateRequest(['outcome', 'summary']),
  handleErrors(async (req, res) => {
    const result = await disputeService.resolveDispute(req.params.id, {
      adminId: req.adminId,
      outcome: req.body.outcome,
      summary: req.body.summary,
      txHash: req.body.txHash || null,
    });

    res.status(200).json(result);
  })
);

/**
 * PATCH /disputes/:id/reject
 * Reject a dispute (admin only)
 *
 * Request body:
 * {
 *   "reason": "string"
 * }
 *
 * Headers:
 * {
 *   "x-admin-id": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { rejected dispute object },
 *   "message": "Dispute rejected successfully"
 * }
 */
router.patch(
  '/:id/reject',
  requireAdmin,
  validateRequest(['reason']),
  handleErrors(async (req, res) => {
    const result = await disputeService.rejectDispute(
      req.params.id,
      req.adminId,
      req.body.reason
    );

    res.status(200).json(result);
  })
);

/**
 * GET /disputes/analytics
 * Retrieve comprehensive dispute analytics
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "totalDisputes": number,
 *       "statusBreakdown": { ... }
 *     },
 *     "resolution": {
 *       "averageResolutionTime": "string",
 *       "averageResolutionTimeMs": number,
 *       ...
 *     },
 *     "marketMetrics": [ ... ],
 *     "outcomes": { ... },
 *     "evidence": { ... },
 *     "timestamp": Date
 *   }
 * }
 */
router.get(
  '/analytics',
  handleErrors(async (req, res) => {
    const result = await disputeService.getDisputeAnalytics();
    res.status(200).json(result);
  })
);

module.exports = router;
