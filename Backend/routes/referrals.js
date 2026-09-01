const express = require('express');
const referralService = require('../services/referralService');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'REFERRAL_ERROR',
    });
  }
};

/**
 * GET /code/:userId
 * Get or generate referral code for a user
 */
router.get(
  '/code/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const code = await referralService.generateCode(userId);
    res.json({ success: true, data: { code } });
  })
);

/**
 * POST /register
 * Register a new referral
 */
router.post(
  '/register',
  handleErrors(async (req, res) => {
    const { referrerCode, referredId } = req.body;
    if (!referrerCode || !referredId) {
      throw new Error('referrerCode and referredId are required');
    }
    const referral = await referralService.registerReferral(referrerCode, referredId);
    res.status(201).json({ success: true, data: referral });
  })
);

/**
 * GET /stats/:userId
 * Get referral statistics
 */
router.get(
  '/stats/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const stats = await referralService.getReferralStats(userId);
    res.json({ success: true, data: stats });
  })
);

/**
 * GET /analytics/:userId
 * Get referral analytics
 */
router.get(
  '/analytics/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const analytics = await referralService.getReferralAnalytics(userId);
    res.json({ success: true, data: analytics });
  })
);

/**
 * POST /refresh-rewards/:referredId
 * Manually trigger reward calculation
 */
router.post(
  '/refresh-rewards/:referredId',
  handleErrors(async (req, res) => {
    const { referredId } = req.params;
    await referralService.updateReferralRewards(referredId);
    res.json({ success: true, message: 'Rewards updated' });
  })
);

/**
 * GET /on-chain-referrer/:traderAddress
 * Resolve on-chain referrer for a trader address
 */
router.get(
  '/on-chain-referrer/:traderAddress',
  handleErrors(async (req, res) => {
    const { traderAddress } = req.params;
    const referrer = await referralService.resolveOnChainReferrer(traderAddress);
    res.json({ success: true, data: { trader: traderAddress, referrer } });
  })
);

/**
 * POST /link-on-chain-referrer
 * Link an on-chain referrer to a referral record
 */
router.post(
  '/link-on-chain-referrer',
  handleErrors(async (req, res) => {
    const { traderAddress, referrerAddress } = req.body;
    if (!traderAddress || !referrerAddress) {
      throw new Error('traderAddress and referrerAddress are required');
    }
    const referral = await referralService.linkOnChainReferrer(traderAddress, referrerAddress);
    res.json({ success: true, data: referral });
  })
);

/**
 * POST /process-rebate/:tradeId
 * Process rebate attribution for an on-chain trade
 */
router.post(
  '/process-rebate/:tradeId',
  handleErrors(async (req, res) => {
    const { tradeId } = req.params;
    const result = await referralService.processOnChainTradeRebate(tradeId);
    res.json({ success: true, data: result });
  })
);

/**
 * GET /on-chain-stats/:referrerAddress
 * Get on-chain rebate statistics for a referrer
 */
router.get(
  '/on-chain-stats/:referrerAddress',
  handleErrors(async (req, res) => {
    const { referrerAddress } = req.params;
    const stats = await referralService.getOnChainRebateStats(referrerAddress);
    res.json({ success: true, data: stats });
  })
);

module.exports = router;
