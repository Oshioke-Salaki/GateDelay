const express = require('express');
const { ethers } = require('ethers');
const multisigService = require('../services/multisigService');
const { strictDDoSGuard } = require('../middleware/ddosGuard');

const router = express.Router();

/**
 * Threat notes (security review — issue #702):
 *  - Trust boundary: HTTP clients are untrusted. Wallet ids, addresses, tx
 *    payloads, and signatures are validated before any service call.
 *  - Mutations are fail-closed. Propose and execute require an EIP-191
 *    owner signature bound to the request; sign already carries that proof
 *    in `signature` (verified in the service). Header-only identity is not
 *    accepted.
 *  - Authorization: recovered signers must be configured owners of the
 *    target wallet. Unknown or reserved wallet ids never resolve via
 *    prototype lookup.
 *  - GET /status redacts raw signature blobs so this read path cannot be
 *    used to harvest replayable approvals. GET /wallet is public metadata
 *    (same data a chain explorer would show) but is rate-limited.
 *  - Errors map to stable client codes. Raw stacks, connection strings,
 *    and authentication material are not logged or returned.
 *  - Abuse control: every route, including reads, uses strictDDoSGuard.
 */

const WALLET_ID_RE = /^[A-Z][A-Z0-9_]{0,31}$/;
const TX_ID_RE = /^0x[0-9a-f]{64}$/;
const HEX_DATA_RE = /^0x[0-9a-fA-F]*$/;
const MAX_SIGNATURE_LENGTH = 200;
const MIN_SIGNATURE_LENGTH = 80;
const MAX_TARGET_LENGTH = 128;
const MAX_CALLDATA_LENGTH = 10_000;

const KNOWN_CLIENT_ERRORS = new Map([
  ['Multisig wallet not found', { status: 404, code: 'NOT_FOUND' }],
  ['Transaction not found', { status: 404, code: 'NOT_FOUND' }],
  ['Proposer is not a valid address', { status: 400, code: 'VALIDATION_ERROR' }],
  ['Owner is not a valid address', { status: 400, code: 'VALIDATION_ERROR' }],
  ['Executor is not a valid address', { status: 400, code: 'VALIDATION_ERROR' }],
  ['Proposer is not an owner of this multisig', { status: 403, code: 'FORBIDDEN' }],
  ['Signer is not an owner of this multisig', { status: 403, code: 'FORBIDDEN' }],
  ['Executor is not an owner of this multisig', { status: 403, code: 'FORBIDDEN' }],
  ['Invalid signature', { status: 400, code: 'VALIDATION_ERROR' }],
  ['Signature does not match owner', { status: 401, code: 'UNAUTHORIZED' }],
  ['Owner has already signed this transaction', { status: 409, code: 'CONFLICT' }],
]);

function sanitizeErrorMessage(message) {
  if (typeof message !== 'string') return 'Request could not be processed';
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"')>]*/gi, '[redacted]')
    .replace(/[^@\s"'(]*:[^@\s"'(]+@[^\s"')>]+/g, '[redacted]')
    .replace(/redis(?:s)?:\/\/[^\s"')>]*/gi, '[redacted]');
}

function clientError(error) {
  const sanitized = sanitizeErrorMessage(error && error.message);
  const mapped = KNOWN_CLIENT_ERRORS.get(sanitized);
  if (mapped) {
    return { status: mapped.status, error: sanitized, code: mapped.code };
  }
  if (sanitized.startsWith('Insufficient signatures')) {
    return { status: 400, error: sanitized, code: 'MULTISIG_ERROR' };
  }
  return { status: 400, error: 'Request could not be processed', code: 'MULTISIG_ERROR' };
}

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    const payload = clientError(error);
    console.error('Multisig Route Error:', payload.error);
    res.status(payload.status).json({
      success: false,
      error: payload.error,
      code: payload.code,
    });
  }
};

function isLikelySignature(value) {
  return typeof value === 'string'
    && value.length >= MIN_SIGNATURE_LENGTH
    && value.length <= MAX_SIGNATURE_LENGTH;
}

function parseWalletId(walletId) {
  if (typeof walletId !== 'string' || !WALLET_ID_RE.test(walletId)) {
    return null;
  }
  return walletId;
}

function parseTxId(txId) {
  if (typeof txId !== 'string' || !TX_ID_RE.test(txId)) {
    return null;
  }
  return txId;
}

function parseAddress(value) {
  if (typeof value !== 'string') return null;
  try {
    return ethers.getAddress(value);
  } catch {
    return null;
  }
}

function normalizeTxData(txData) {
  if (!txData || typeof txData !== 'object' || Array.isArray(txData)) {
    return null;
  }

  const { target, value, data } = txData;
  if (typeof target !== 'string' || target.length === 0 || target.length > MAX_TARGET_LENGTH) {
    return null;
  }
  if (value !== undefined && !/^\d+$/.test(String(value))) {
    return null;
  }
  if (data !== undefined) {
    if (typeof data !== 'string' || !HEX_DATA_RE.test(data) || data.length > MAX_CALLDATA_LENGTH) {
      return null;
    }
  }

  return {
    target,
    value: value !== undefined ? String(value) : '0',
    data: data || '0x',
  };
}

function buildProposeChallenge(walletId, txData) {
  return `gatedelay-multisig:propose:${walletId}:${JSON.stringify(txData)}`;
}

function buildExecuteChallenge(txId) {
  return `gatedelay-multisig:execute:${txId}`;
}

/**
 * Recover an owner from an EIP-191 personal_sign over `message`.
 * Failed proofs all return the same 401 so callers cannot distinguish
 * missing, malformed, or mismatched credentials.
 */
function verifyOwnerProof(claimedAddress, signature, message) {
  const address = parseAddress(claimedAddress);
  if (!address || !isLikelySignature(signature) || typeof message !== 'string') {
    return { ok: false };
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return { ok: false };
  }

  if (recovered !== address) {
    return { ok: false };
  }

  return { ok: true, address };
}

function rejectUnauthorized(res) {
  return res.status(401).json({
    success: false,
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
  });
}

function rejectForbidden(res) {
  return res.status(403).json({
    success: false,
    error: 'Not authorized for this wallet',
    code: 'FORBIDDEN',
  });
}

function rejectValidation(res, message) {
  return res.status(400).json({
    success: false,
    error: message,
    code: 'VALIDATION_ERROR',
  });
}

function redactTransaction(tx) {
  if (!tx || typeof tx !== 'object') return tx;
  return {
    id: tx.id,
    walletId: tx.walletId,
    data: tx.data,
    proposer: tx.proposer,
    status: tx.status,
    createdAt: tx.createdAt,
    executedAt: tx.executedAt,
    txHash: tx.txHash,
    signatures: Array.isArray(tx.signatures)
      ? tx.signatures.map((entry) => ({
        owner: entry.owner,
        timestamp: entry.timestamp,
      }))
      : [],
  };
}

// Rate-limit the whole surface, including previously open GET routes.
router.use(strictDDoSGuard());

/**
 * GET /api/multisig/wallet/:walletId
 * Public wallet metadata (owners / threshold). Rate-limited; id is allowlisted.
 */
router.get('/wallet/:walletId', handleErrors(async (req, res) => {
  const walletId = parseWalletId(req.params.walletId);
  if (!walletId) {
    return rejectValidation(res, 'Invalid walletId');
  }

  const wallet = multisigService.getWallet(walletId);
  res.json({ success: true, data: wallet });
}));

/**
 * POST /api/multisig/propose
 * Propose a new multisig transaction.
 *
 * Body: { walletId, txData: { target, value?, data? }, proposer, proposerSignature }
 * proposerSignature is EIP-191 over buildProposeChallenge(walletId, normalizedTxData).
 */
router.post('/propose', handleErrors(async (req, res) => {
  const { walletId: rawWalletId, txData: rawTxData, proposer, proposerSignature } = req.body || {};

  const walletId = parseWalletId(rawWalletId);
  if (!walletId) {
    return rejectValidation(res, 'Invalid walletId');
  }

  const txData = normalizeTxData(rawTxData);
  if (!txData) {
    return rejectValidation(res, 'Invalid txData');
  }

  const proof = verifyOwnerProof(
    proposer,
    proposerSignature,
    buildProposeChallenge(walletId, txData)
  );
  if (!proof.ok) {
    return rejectUnauthorized(res);
  }

  if (!multisigService.isOwner(walletId, proof.address)) {
    return rejectForbidden(res);
  }

  const txId = await multisigService.proposeTransaction(walletId, txData, proof.address);
  res.json({ success: true, data: { txId } });
}));

/**
 * POST /api/multisig/sign
 * Collect a signature for a transaction. `signature` over txId is the auth proof.
 */
router.post('/sign', handleErrors(async (req, res) => {
  const { txId: rawTxId, owner, signature } = req.body || {};

  const txId = parseTxId(rawTxId);
  if (!txId) {
    return rejectValidation(res, 'Invalid txId');
  }
  if (!parseAddress(owner)) {
    return rejectValidation(res, 'Invalid owner');
  }
  if (!isLikelySignature(signature)) {
    return rejectUnauthorized(res);
  }

  const result = await multisigService.collectSignature(txId, owner, signature);
  res.json({ success: true, data: redactTransaction(result) });
}));

/**
 * POST /api/multisig/execute
 * Execute a transaction that has reached threshold.
 *
 * Body: { txId, executor, executorSignature }
 * executorSignature is EIP-191 over buildExecuteChallenge(txId).
 */
router.post('/execute', handleErrors(async (req, res) => {
  const { txId: rawTxId, executor, executorSignature } = req.body || {};

  const txId = parseTxId(rawTxId);
  if (!txId) {
    return rejectValidation(res, 'Invalid txId');
  }

  const proof = verifyOwnerProof(
    executor,
    executorSignature,
    buildExecuteChallenge(txId)
  );
  if (!proof.ok) {
    return rejectUnauthorized(res);
  }

  const pending = multisigService.getTransactionStatus(txId);
  if (!multisigService.isOwner(pending.walletId, proof.address)) {
    return rejectForbidden(res);
  }

  const result = await multisigService.processTransaction(txId, proof.address);
  res.json({ success: true, data: redactTransaction(result) });
}));

/**
 * GET /api/multisig/status/:txId
 * Track status without returning replayable signature material.
 */
router.get('/status/:txId', handleErrors(async (req, res) => {
  const txId = parseTxId(req.params.txId);
  if (!txId) {
    return rejectValidation(res, 'Invalid txId');
  }

  const status = multisigService.getTransactionStatus(txId);
  res.json({ success: true, data: redactTransaction(status) });
}));

module.exports = router;
module.exports.buildProposeChallenge = buildProposeChallenge;
module.exports.buildExecuteChallenge = buildExecuteChallenge;
