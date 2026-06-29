const express = require('express');
const bridgeService = require('../services/bridgeService');

const router = express.Router();

/**
 * Error handling middleware
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Bridge Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'BRIDGE_ERROR',
    });
  }
};

/**
 * GET /api/bridge/protocols
 * List supported bridge protocols and the chains they route between.
 */
router.get('/protocols', (req, res) => {
  res.json({ success: true, data: bridgeService.PROTOCOLS });
});

/**
 * POST /api/bridge/transfers
 * Initiate a cross-chain bridge transfer.
 * Body: { protocol, sourceChain, destChain, token, amount, sender, recipient }
 */
router.post('/transfers', handleErrors(async (req, res) => {
  const transfer = await bridgeService.initiateTransfer(req.body);
  res.status(201).json({ success: true, data: transfer });
}));

/**
 * GET /api/bridge/transfers
 * List transfers, optionally filtered by ?status=&protocol=&sender=
 */
router.get('/transfers', handleErrors(async (req, res) => {
  const { status, protocol, sender } = req.query;
  const transfers = await bridgeService.listTransfers({ status, protocol, sender });
  res.json({ success: true, data: transfers });
}));

/**
 * GET /api/bridge/transfers/:id
 * Get the current status and confirmations of a single transfer.
 */
router.get('/transfers/:id', handleErrors(async (req, res) => {
  const transfer = await bridgeService.getTransfer(req.params.id);
  res.json({ success: true, data: transfer });
}));

/**
 * PATCH /api/bridge/transfers/:id/confirmations
 * Record source-chain confirmations and advance the transfer status.
 * Body: { confirmations, sourceTxHash?, destTxHash? }
 */
router.patch('/transfers/:id/confirmations', handleErrors(async (req, res) => {
  const { confirmations, sourceTxHash, destTxHash } = req.body;
  const transfer = await bridgeService.updateConfirmations(
    req.params.id,
    confirmations,
    { sourceTxHash, destTxHash }
  );
  res.json({ success: true, data: transfer });
}));

/**
 * POST /api/bridge/transfers/:id/fail
 * Mark a transfer as failed.
 * Body: { reason? }
 */
router.post('/transfers/:id/fail', handleErrors(async (req, res) => {
  const transfer = await bridgeService.failTransfer(req.params.id, req.body.reason);
  res.json({ success: true, data: transfer });
}));

/**
 * GET /api/bridge/analytics
 * Aggregate analytics across all bridge transfers.
 */
router.get('/analytics', handleErrors(async (req, res) => {
  const analytics = await bridgeService.getBridgeAnalytics();
  res.json({ success: true, data: analytics });
}));

module.exports = router;
