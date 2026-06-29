/**
 * WHITELIST ROUTES
 * API endpoints for managing market whitelist operations and access control.
 *
 * Operator authorization via headers:
 *   x-operator-id: <operatorId>
 */

const express = require('express');
const whitelistService = require('../services/whitelistService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────── Middleware

/**
 * Wrap async route handlers and normalize errors.
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Whitelist Route Error:', error.message);

    // Address validation errors are 400
    const status = error.message.includes('Invalid Ethereum address') ||
      error.message.includes('required') ||
      error.message.includes('Batch size')
      ? 400
      : 400;

    res.status(status).json({
      success: false,
      error: error.message,
      code: 'WHITELIST_ERROR',
    });
  }
};

/**
 * Validate required body fields.
 */
const validateRequest = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(
    (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
  );
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }
  next();
};

/**
 * Require operator identity header.
 */
const requireOperator = (req, res, next) => {
  const operatorId = req.headers['x-operator-id'];
  if (!operatorId) {
    return res.status(401).json({
      success: false,
      error: 'Missing x-operator-id header',
      code: 'UNAUTHORIZED',
    });
  }
  req.operatorId = operatorId;
  next();
};

// ─────────────────────────────────────────────────────────────── Routes

/**
 * GET /whitelist/:marketId
 * Get all whitelisted addresses for a market (paginated).
 *
 * Query params:
 *   page (optional, default 1)
 *   limit (optional, default 50)
 *   includeExpired (optional, boolean)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "marketId": string,
 *     "entries": [ { address, marketId, addedBy, addedAt, expiresAt, notes } ],
 *     "total": number,
 *     "page": number,
 *     "totalPages": number
 *   }
 * }
 */
router.get(
  '/:marketId',
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const includeExpired = req.query.includeExpired === 'true';

    const result = await whitelistService.getWhitelistForMarket({
      marketId,
      includeExpired,
      page,
      limit,
    });

    res.status(200).json(result);
  })
);

/**
 * GET /whitelist/:marketId/stats
 * Get whitelist statistics for a market.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "marketId": string,
 *     "activeCount": number,
 *     "expiredCount": number,
 *     "totalCount": number,
 *     "inactiveCount": number
 *   }
 * }
 */
router.get(
  '/:marketId/stats',
  handleErrors(async (req, res) => {
    const result = await whitelistService.getWhitelistStats(req.params.marketId);
    res.status(200).json(result);
  })
);

/**
 * GET /whitelist/:marketId/check/:address
 * Check if a specific address is whitelisted for a market.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "address": string,
 *     "marketId": string,
 *     "whitelisted": boolean,
 *     "entry": object | null,
 *     "source": "cache" | "db"
 *   }
 * }
 */
router.get(
  '/:marketId/check/:address',
  handleErrors(async (req, res) => {
    const result = await whitelistService.isWhitelisted(
      req.params.address,
      req.params.marketId
    );
    res.status(200).json(result);
  })
);

/**
 * POST /whitelist/:marketId
 * Add a single address to a market's whitelist.
 *
 * Headers:
 *   x-operator-id: <string>
 *
 * Request body:
 * {
 *   "address": "0x...",
 *   "notes": "string (optional)",
 *   "expiresAt": "ISO date string (optional)",
 *   "metadata": { ... } (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { whitelist entry },
 *   "message": string
 * }
 */
router.post(
  '/:marketId',
  requireOperator,
  validateRequest(['address']),
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { address, notes, expiresAt, metadata } = req.body;

    const result = await whitelistService.addAddress({
      address,
      marketId,
      operatorId: req.operatorId,
      notes,
      expiresAt,
      metadata,
    });

    res.status(201).json(result);
  })
);

/**
 * DELETE /whitelist/:marketId/:address
 * Remove an address from a market's whitelist.
 *
 * Headers:
 *   x-operator-id: <string>
 *
 * Request body:
 * {
 *   "reason": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { updated entry },
 *   "message": string
 * }
 */
router.delete(
  '/:marketId/:address',
  requireOperator,
  handleErrors(async (req, res) => {
    const { marketId, address } = req.params;
    const { reason } = req.body;

    const result = await whitelistService.removeAddress({
      address,
      marketId,
      operatorId: req.operatorId,
      reason,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /whitelist/:marketId/batch/add
 * Batch add multiple addresses to a market's whitelist.
 *
 * Headers:
 *   x-operator-id: <string>
 *
 * Request body:
 * {
 *   "addresses": ["0x...", "0x...", ...],  (max 500)
 *   "notes": "string (optional)",
 *   "expiresAt": "ISO date string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "added": ["0x..."],
 *     "failed": [ { address, error } ],
 *     "addedCount": number,
 *     "failedCount": number,
 *     "marketId": string
 *   }
 * }
 */
router.post(
  '/:marketId/batch/add',
  requireOperator,
  validateRequest(['addresses']),
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { addresses, notes, expiresAt } = req.body;

    if (!Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: 'addresses must be an array',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await whitelistService.batchAddAddresses({
      addresses,
      marketId,
      operatorId: req.operatorId,
      notes,
      expiresAt,
    });

    res.status(200).json(result);
  })
);

/**
 * POST /whitelist/:marketId/batch/remove
 * Batch remove multiple addresses from a market's whitelist.
 *
 * Headers:
 *   x-operator-id: <string>
 *
 * Request body:
 * {
 *   "addresses": ["0x...", "0x...", ...],  (max 500)
 *   "reason": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "removed": ["0x..."],
 *     "removedCount": number,
 *     "failed": [ { address, error } ],
 *     "failedCount": number,
 *     "marketId": string
 *   }
 * }
 */
router.post(
  '/:marketId/batch/remove',
  requireOperator,
  validateRequest(['addresses']),
  handleErrors(async (req, res) => {
    const { marketId } = req.params;
    const { addresses, reason } = req.body;

    if (!Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: 'addresses must be an array',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await whitelistService.batchRemoveAddresses({
      addresses,
      marketId,
      operatorId: req.operatorId,
      reason,
    });

    res.status(200).json(result);
  })
);

module.exports = router;
