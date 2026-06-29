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

module.exports = router;
