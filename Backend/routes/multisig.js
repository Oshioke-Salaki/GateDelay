const express = require('express');
const multisigService = require('../services/multisigService');

const router = express.Router();

/**
 * Error handling wrapper
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Multisig Route Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'MULTISIG_ERROR'
    });
  }
};

/**
 * GET /api/multisig/wallet/:walletId
 * Get details of a multisig wallet
 */
router.get('/wallet/:walletId', handleErrors(async (req, res) => {
  const { walletId } = req.params;
  const wallet = multisigService.getWallet(walletId);
  res.json({ success: true, data: wallet });
}));

/**
 * POST /api/multisig/propose
 * Propose a new multisig transaction
 */
router.post('/propose', handleErrors(async (req, res) => {
  const { walletId, txData, proposer } = req.body;
  
  if (!walletId || !txData || !proposer) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: walletId, txData, proposer'
    });
  }

  const txId = await multisigService.proposeTransaction(walletId, txData, proposer);
  res.json({ success: true, data: { txId } });
}));

/**
 * POST /api/multisig/sign
 * Collect a signature for a transaction
 */
router.post('/sign', handleErrors(async (req, res) => {
  const { txId, owner, signature } = req.body;

  if (!txId || !owner || !signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: txId, owner, signature'
    });
  }

  const result = await multisigService.collectSignature(txId, owner, signature);
  res.json({ success: true, data: result });
}));

/**
 * POST /api/multisig/execute
 * Execute a transaction that has reached threshold
 */
router.post('/execute', handleErrors(async (req, res) => {
  const { txId } = req.body;

  if (!txId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: txId'
    });
  }

  const result = await multisigService.processTransaction(txId);
  res.json({ success: true, data: result });
}));

/**
 * GET /api/multisig/status/:txId
 * Track the status of a multisig transaction
 */
router.get('/status/:txId', handleErrors(async (req, res) => {
  const { txId } = req.params;
  const status = multisigService.getTransactionStatus(txId);
  res.json({ success: true, data: status });
}));

module.exports = router;
