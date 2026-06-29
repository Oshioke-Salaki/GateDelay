const express = require('express');
const miningService = require('../services/miningService');

const router = express.Router();

/**
 * Error handling wrapper
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Mining Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'MINING_ERROR'
    });
  }
};

/**
 * GET /api/mining/programs
 * List all available liquidity mining programs
 */
router.get('/programs', (req, res) => {
  const programs = miningService.getPrograms();
  res.json({ success: true, data: programs });
});

/**
 * GET /api/mining/participation/:address
 * Track participation and pending rewards for a user
 */
router.get('/participation/:address', handleErrors(async (req, res) => {
  const { address } = req.params;
  const participation = await miningService.trackParticipation(address);
  res.json({ success: true, data: participation });
}));

/**
 * POST /api/mining/distribute
 * Manually trigger or handle automatic reward distribution
 */
router.post('/distribute', handleErrors(async (req, res) => {
  const { address, programId } = req.body;

  if (!address || !programId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: address, programId',
      code: 'VALIDATION_ERROR'
    });
  }

  const result = await miningService.distributeRewards(address, programId);
  res.json({ success: true, data: result });
}));

/**
 * GET /api/mining/stats
 * Get mining program statistics
 */
router.get('/stats', handleErrors(async (req, res) => {
  const { programId } = req.query;
  const stats = await miningService.getMiningStats(programId);
  res.json({ success: true, data: stats });
}));

module.exports = router;
