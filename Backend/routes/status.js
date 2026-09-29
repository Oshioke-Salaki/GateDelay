/**
 * MARKET STATUS ROUTES
 * API endpoints for monitoring and updating market operational status,
 * retrieving uptime analytics, and querying transition history.
 *
 * Operator authorization via headers:
 *   x-operator-id: <operatorId>
 */

const express = require('express');
const statusService = require('../services/statusService');
const { marketStatus: statusSchemas, validateRequest } = require('../dto');

const router = express.Router();

// Wrap async route handlers and handle errors gracefully
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Market Status Route Error:', error.message);
    const status = error.message.includes('required') || error.message.includes('Invalid status')
      ? 400
      : 500;
    res.status(status).json({
      success: false,
      error: error.message,
      code: 'MARKET_STATUS_ERROR',
    });
  }
};

// Middleware: Require operator identity header
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

/**
 * GET /status/:marketId
 * Retrieves the current operational status and uptime statistics of a market.
 */
router.get(
  '/:marketId',
  validateRequest({ params: statusSchemas.marketIdParam }, 'status.get'),
  handleErrors(async (req, res) => {
    const { marketId } = req.validated.params;
    const result = await statusService.getMarketStatus(marketId);
    res.status(200).json(result);
  })
);

/**
 * GET /status/:marketId/history
 * Queries the historical status changes of a market (paginated).
 */
router.get(
  '/:marketId/history',
  validateRequest(
    { params: statusSchemas.marketIdParam, query: statusSchemas.marketStatusHistoryQuery },
    'status.history',
  ),
  handleErrors(async (req, res) => {
    const { marketId } = req.validated.params;
    const { page, limit, fromStatus, toStatus } = req.validated.query;

    const result = await statusService.getStatusHistory({
      marketId,
      limit,
      page,
      fromStatus,
      toStatus,
    });
    res.status(200).json(result);
  })
);

/**
 * POST /status/:marketId/toggle
 * Updates the operational status of a market. Requires operator headers.
 *
 * Request body:
 * {
 *   "status": "PAUSED" | "ACTIVE" | "MAINTENANCE" | "OFFLINE",
 *   "notes": "Optional reason for status change"
 * }
 */
router.post(
  '/:marketId/toggle',
  requireOperator,
  validateRequest(
    { params: statusSchemas.marketIdParam, body: statusSchemas.marketStatusToggleBody },
    'status.toggle',
  ),
  handleErrors(async (req, res) => {
    const { marketId } = req.validated.params;
    const { status, notes } = req.validated.body;

    const result = await statusService.updateMarketStatus({
      marketId,
      status,
      operatorId: req.operatorId,
      notes,
    });

    res.status(200).json(result);
  })
);

module.exports = router;
