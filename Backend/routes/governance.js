const express = require('express');
const governanceService = require('../services/governanceService');

const router = express.Router();

/**
 * Error handling wrapper
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Governance Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'GOVERNANCE_ERROR'
    });
  }
};

/**
 * POST /api/governance/propose
 * Create a new governance proposal
 */
router.post('/propose', handleErrors(async (req, res) => {
  const { title, description, proposer, actions } = req.body;

  if (!title || !proposer) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: title, proposer'
    });
  }

  const proposalId = await governanceService.createProposal({ title, description, proposer, actions });
  res.json({ success: true, data: { proposalId } });
}));

/**
 * POST /api/governance/vote
 * Cast a vote on a proposal
 */
router.post('/vote', handleErrors(async (req, res) => {
  const { proposalId, voter, support, weight } = req.body;

  if (!proposalId || !voter || weight === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: proposalId, voter, weight'
    });
  }

  const result = await governanceService.castVote(proposalId, voter, support, weight);
  res.json({ success: true, data: result });
}));

/**
 * POST /api/governance/execute
 * Execute a proposal that has succeeded
 */
router.post('/execute', handleErrors(async (req, res) => {
  const { proposalId } = req.body;

  if (!proposalId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: proposalId'
    });
  }

  const result = await governanceService.executeProposal(proposalId);
  res.json({ success: true, data: result });
}));

/**
 * GET /api/governance/history
 * List governance history
 */
router.get('/history', handleErrors(async (req, res) => {
  const history = await governanceService.getGovernanceHistory();
  res.json({ success: true, data: history });
}));

/**
 * GET /api/governance/analytics
 * Provide governance analytics
 */
router.get('/analytics', handleErrors(async (req, res) => {
  const analytics = await governanceService.getGovernanceAnalytics();
  res.json({ success: true, data: analytics });
}));

module.exports = router;
