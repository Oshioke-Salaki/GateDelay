const express = require('express');
const swapService = require('../services/swapService');

const router = express.Router();

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Swap Route Error:', error.message);
    res.status(400).json({ success: false, error: error.message, code: 'SWAP_ERROR' });
  }
};

/**
 * GET /api/swaps/tokens
 * List supported tokens.
 */
router.get('/tokens', (req, res) => {
  res.json({ success: true, data: swapService.SUPPORTED_TOKENS });
});

/**
 * GET /api/swaps/quote
 * Get a swap quote.
 * Query: tokenIn, tokenOut, amountIn, slippageTolerance?
 */
router.get('/quote', handleErrors(async (req, res) => {
  const { tokenIn, tokenOut, amountIn, slippageTolerance } = req.query;
  const quote = await swapService.getQuote({
    tokenIn,
    tokenOut,
    amountIn,
    slippageTolerance: slippageTolerance ? Number(slippageTolerance) : undefined,
  });
  res.json({ success: true, data: quote });
}));

/**
 * POST /api/swaps/execute
 * Execute a token swap.
 * Body: { tokenIn, tokenOut, amountIn, slippageTolerance?, sender, recipient }
 */
router.post('/execute', handleErrors(async (req, res) => {
  const swap = await swapService.executeSwap(req.body);
  res.status(201).json({ success: true, data: swap });
}));

/**
 * GET /api/swaps
 * List swap transactions. Query: status?, tokenIn?, tokenOut?, sender?
 */
router.get('/', handleErrors(async (req, res) => {
  const { status, tokenIn, tokenOut, sender } = req.query;
  const swaps = await swapService.listSwaps({ status, tokenIn, tokenOut, sender });
  res.json({ success: true, data: swaps });
}));

/**
 * GET /api/swaps/:id
 * Get a single swap transaction.
 */
router.get('/:id', handleErrors(async (req, res) => {
  const swap = await swapService.getSwap(req.params.id);
  res.json({ success: true, data: swap });
}));

/**
 * GET /api/swaps/analytics/summary
 * Aggregate swap analytics.
 */
router.get('/analytics/summary', handleErrors(async (req, res) => {
  const analytics = await swapService.getSwapAnalytics();
  res.json({ success: true, data: analytics });
}));

module.exports = router;
