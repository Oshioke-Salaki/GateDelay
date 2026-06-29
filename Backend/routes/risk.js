const express = require('express');
const riskService = require('../services/riskService');

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
      code: 'RISK_ERROR',
    });
  }
};

/**
 * POST /score/concentration
 * Calculate portfolio concentration risk
 */
router.post(
  '/score/concentration',
  handleErrors(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const result = await riskService.calculateConcentrationRisk(userId);
    res.json(result);
  }),
);

/**
 * POST /score/volatility
 * Calculate volatility risk
 */
router.post(
  '/score/volatility',
  handleErrors(async (req, res) => {
    const { assetSymbol, priceHistory } = req.body;

    if (!assetSymbol || !priceHistory) {
      return res.status(400).json({
        success: false,
        error: 'Missing assetSymbol or priceHistory',
      });
    }

    const result = riskService.calculateVolatilityRisk(
      assetSymbol,
      priceHistory,
    );
    res.json({ success: true, data: result });
  }),
);

/**
 * POST /score/leverage
 * Calculate leverage risk
 */
router.post(
  '/score/leverage',
  handleErrors(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const result = await riskService.calculateLeverageRisk(userId);
    res.json(result);
  }),
);

/**
 * POST /score/liquidation-proximity
 * Calculate liquidation proximity risk
 */
router.post(
  '/score/liquidation-proximity',
  handleErrors(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const result = await riskService.calculateLiquidationProximityRisk(userId);
    res.json(result);
  }),
);

/**
 * GET /score/overall/:userId
 * Calculate overall risk score
 */
router.get(
  '/score/overall/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;

    const result = await riskService.calculateOverallRiskScore(userId);
    res.json(result);
  }),
);

/**
 * GET /config
 * Get risk configuration
 */
router.get(
  '/config',
  handleErrors(async (req, res) => {
    const { userId } = req.query;

    const result = await riskService.getRiskConfig(userId);
    res.json(result);
  }),
);

/**
 * PUT /config/:userId
 * Update risk thresholds
 */
router.put(
  '/config/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const { thresholds } = req.body;

    if (!thresholds) {
      return res.status(400).json({
        success: false,
        error: 'Missing thresholds',
      });
    }

    const result = await riskService.updateRiskThresholds(userId, thresholds);
    res.json(result);
  }),
);

/**
 * GET /alerts/:userId
 * Check risk triggers and get alerts
 */
router.get(
  '/alerts/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;

    const result = await riskService.checkRiskTriggers(userId);
    res.json(result);
  }),
);

/**
 * POST /restrictions/check
 * Check risk-based restrictions for operation
 */
router.post(
  '/restrictions/check',
  handleErrors(async (req, res) => {
    const { userId, operation } = req.body;

    if (!userId || !operation) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or operation',
      });
    }

    const result = await riskService.checkRiskRestrictions(userId, operation);
    res.json(result);
  }),
);

/**
 * GET /metrics
 * Get system-wide risk metrics
 */
router.get(
  '/metrics',
  handleErrors(async (req, res) => {
    const result = await riskService.getRiskMetrics();
    res.json(result);
  }),
);

module.exports = router;
