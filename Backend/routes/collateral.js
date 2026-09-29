const express = require('express');
const collateralService = require('../services/collateralService');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'COLLATERAL_ERROR',
    });
  }
};

/**
 * POST /deposit
 * Create a new collateral deposit
 *
 * Body: {
 *   userId: string,
 *   assetSymbol: string,
 *   depositAmount: string,
 *   currentPrice: string,
 *   requiredRatio?: string,
 *   liquidationThreshold?: string
 * }
 */
router.post(
  '/deposit',
  handleErrors(async (req, res) => {
    const {
      userId,
      assetSymbol,
      depositAmount,
      currentPrice,
      requiredRatio,
      liquidationThreshold,
    } = req.body;

    // Validate required fields
    if (!userId || !assetSymbol || !depositAmount || !currentPrice) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: userId, assetSymbol, depositAmount, currentPrice',
      });
    }

    const result = await collateralService.depositCollateral({
      userId,
      assetSymbol,
      depositAmount,
      currentPrice,
      requiredRatio,
      liquidationThreshold,
    });

    res.status(201).json(result);
  }),
);

/**
 * PUT /update-value/:collateralId
 * Update collateral current value based on new price
 *
 * Body: {
 *   newPrice: string,
 *   borrowAmount?: string
 * }
 */
router.put(
  '/update-value/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { newPrice, borrowAmount } = req.body;

    if (!newPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: newPrice',
      });
    }

    const result = await collateralService.updateCollateralValue(
      collateralId,
      newPrice,
      borrowAmount,
    );

    res.json(result);
  }),
);

/**
 * GET /ratio/:collateralId
 * Calculate collateralization ratio for a collateral
 *
 * Query: {
 *   borrowAmount: string (required)
 * }
 */
router.get(
  '/ratio/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { borrowAmount } = req.query;

    if (!borrowAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: borrowAmount',
      });
    }

    const result = await collateralService.calculateCollateralRatio(
      collateralId,
      borrowAmount,
    );

    res.json(result);
  }),
);

/**
 * POST /liquidate/:collateralId
 * Trigger liquidation for a collateral
 *
 * Body: {
 *   reason?: string
 * }
 */
router.post(
  '/liquidate/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { reason } = req.body;

    const result = await collateralService.triggerLiquidation(
      collateralId,
      reason,
    );

    res.json(result);
  }),
);

/**
 * POST /liquidate/complete/:collateralId
 * Complete liquidation for a collateral
 *
 * Body: {
 *   liquidationProceeds: string (required)
 * }
 */
router.post(
  '/liquidate/complete/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { liquidationProceeds } = req.body;

    if (!liquidationProceeds) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: liquidationProceeds',
      });
    }

    const result = await collateralService.completeLiquidation(
      collateralId,
      liquidationProceeds,
    );

    res.json(result);
  }),
);

/**
 * POST /withdraw/:collateralId
 * Withdraw collateral
 *
 * Body: {
 *   withdrawAmount: string (required)
 * }
 */
router.post(
  '/withdraw/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { withdrawAmount } = req.body;

    if (!withdrawAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: withdrawAmount',
      });
    }

    const result = await collateralService.withdrawCollateral(
      collateralId,
      withdrawAmount,
    );

    res.json(result);
  }),
);

/**
 * GET /:collateralId
 * Retrieve a single collateral by ID
 */
router.get(
  '/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;

    const result = await collateralService.getCollateral(collateralId);

    res.json(result);
  }),
);

/**
 * GET /user/:userId
 * Retrieve all collaterals for a user
 *
 * Query: {
 *   status?: string,
 *   assetSymbol?: string,
 *   page?: number,
 *   limit?: number
 * }
 */
router.get(
  '/user/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const { status, assetSymbol, page, limit } = req.query;

    const result = await collateralService.getUserCollaterals(userId, {
      status,
      assetSymbol,
      page,
      limit,
    });

    res.json(result);
  }),
);

/**
 * GET /analytics/liquidation-candidates
 * Retrieve collaterals eligible for liquidation
 *
 * Query: {
 *   page?: number,
 *   limit?: number
 * }
 */
router.get(
  '/analytics/liquidation-candidates',
  handleErrors(async (req, res) => {
    const { page, limit } = req.query;

    const result = await collateralService.getLiquidationCandidates({
      page,
      limit,
    });

    res.json(result);
  }),
);

/**
 * GET /analytics/overview
 * Retrieve comprehensive collateral analytics
 */
router.get(
  '/analytics/overview',
  handleErrors(async (req, res) => {
    const result = await collateralService.getCollateralAnalytics();

    res.json(result);
  }),
);

/**
 * GET /price-history/:collateralId
 * Retrieve price history for a collateral
 *
 * Query: {
 *   limit?: number (default 100)
 * }
 */
router.get(
  '/price-history/:collateralId',
  handleErrors(async (req, res) => {
    const { collateralId } = req.params;
    const { limit } = req.query;

    const result = await collateralService.getPriceHistory(
      collateralId,
      limit ? parseInt(limit) : 100,
    );

    res.json(result);
  }),
);

module.exports = router;
