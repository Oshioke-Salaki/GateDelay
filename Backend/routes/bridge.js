const express = require('express');
const bridgeService = require('../services/bridgeService');

const router = express.Router();

// ─── Error code → HTTP status mapping ────────────────────────────────────────

const TX_VERIFICATION_ERROR_STATUS = {
  TX_NOT_FOUND:          404,
  TX_PENDING:            422,
  TX_REVERTED:           422,
  TX_SENDER_MISMATCH:    422,
  TX_TOKEN_MISMATCH:     422,
  TX_RECIPIENT_MISMATCH: 422,
  TX_AMOUNT_MISMATCH:    422,
  TX_NO_TRANSFER_EVENT:  422,
  TX_TRANSFER_MISMATCH:  422,
  TX_FETCH_ERROR:        502,
};

/**
 * Error handling middleware.
 * Maps known tx-verification codes to 4xx/5xx; everything else → 400.
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    const status = TX_VERIFICATION_ERROR_STATUS[error.code] || 400;
    console.error('Bridge Route Error:', error.message);
    res.status(status).json({
      success: false,
      error: error.message,
      code: error.code || 'BRIDGE_ERROR',
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
 * List transfers with cursor pagination and optional filters.
 * Query params: ?status=&protocol=&sender=&limit=&cursor=
 * Response includes nextCursor for fetching the next page.
 */
router.get('/transfers', handleErrors(async (req, res) => {
  const { status, protocol, sender, limit, cursor } = req.query;
  const result = await bridgeService.listTransfers(
    { status, protocol, sender },
    { limit, cursor }
  );
  res.json({ success: true, ...result });
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
 *
 * Body: { confirmations, sourceTxHash?, destTxHash?, provider? }
 *
 * sourceTxHash / destTxHash must be a 0x-prefixed 64-character lowercase hex
 * string.  The service will additionally verify the transaction against the
 * immutable transfer intent (sender, recipient, token, amount) when an ethers
 * Provider is supplied via `provider`.
 *
 * In production the provider is injected server-side from the chain config;
 * the client does not supply it directly.
 */
router.patch('/transfers/:id/confirmations', handleErrors(async (req, res) => {
  const { confirmations, sourceTxHash, destTxHash } = req.body;

  // Validate hash format at the route boundary before touching the service.
  // This surfaces a clean 400 with the field name before any DB or RPC call.
  if (sourceTxHash !== undefined && sourceTxHash !== null) {
    bridgeService.validateTxHash(sourceTxHash, 'sourceTxHash');
  }
  if (destTxHash !== undefined && destTxHash !== null) {
    bridgeService.validateTxHash(destTxHash, 'destTxHash');
  }

  // provider is resolved server-side (not from the request body) to prevent
  // callers from supplying an arbitrary RPC endpoint.
  // req.chainProvider is expected to be set by an upstream middleware that
  // maps the transfer's chain to a configured ethers.Provider instance.
  // When absent, hash format is still validated but on-chain verification
  // is skipped (acceptable in development / test environments).
  const provider = req.chainProvider || null;

  const transfer = await bridgeService.updateConfirmations(
    req.params.id,
    confirmations,
    { sourceTxHash, destTxHash, provider }
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

/**
 * GET /api/bridge/archive
 * List archived (evicted) transfers with cursor pagination.
 * Query params: ?status=&protocol=&sender=&limit=&cursor=
 *
 * Archive retention: entries are present for up to BRIDGE_ARCHIVE_RETENTION_MS
 * (default 7 days) after their updatedAt timestamp.
 */
router.get('/archive', handleErrors(async (req, res) => {
  const { status, protocol, sender, limit, cursor } = req.query;
  const result = await bridgeService.listArchivedTransfers(
    { status, protocol, sender },
    { limit, cursor }
  );
  res.json({ success: true, ...result });
}));

/**
 * GET /api/bridge/archive/:id
 * Retrieve a single archived transfer by id.
 */
router.get('/archive/:id', handleErrors(async (req, res) => {
  const transfer = await bridgeService.getArchivedTransfer(req.params.id);
  res.json({ success: true, data: transfer });
}));

module.exports = router;
