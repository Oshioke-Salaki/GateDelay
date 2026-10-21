const { ethers } = require('ethers');
const mongoose = require('mongoose');

// ─── Drift / nonce configuration ────────────────────────────────────────────

/**
 * Parse an environment variable as a positive finite integer within [min, max].
 * Throws a descriptive Error at startup when the value is missing, NaN,
 * non-finite, non-integer, ≤ 0, or outside the provided bounds.
 *
 * @param {string} name    - env var name (used in error messages)
 * @param {string} raw     - process.env value (may be undefined)
 * @param {number} def     - default when raw is undefined / empty
 * @param {number} min     - inclusive lower bound
 * @param {number} max     - inclusive upper bound
 * @returns {number}
 */
function validatePositiveFiniteInt(name, raw, def, min, max) {
  const value = (raw === undefined || raw === '') ? def : Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(
      `[multisigService] ${name} must be a finite number; got ${JSON.stringify(raw)}`
    );
  }
  if (!Number.isInteger(value)) {
    throw new Error(
      `[multisigService] ${name} must be an integer; got ${value}`
    );
  }
  if (value <= 0) {
    throw new Error(
      `[multisigService] ${name} must be positive (> 0); got ${value}`
    );
  }
  if (value < min) {
    throw new Error(
      `[multisigService] ${name} must be >= ${min}ms; got ${value}`
    );
  }
  if (value > max) {
    throw new Error(
      `[multisigService] ${name} must be <= ${max}ms; got ${value}`
    );
  }
  return value;
}

/**
 * Maximum clock-drift between a request timestamp and server time.
 *
 * Env: MULTISIG_TIMESTAMP_DRIFT_MS  (default 30 000 ms = 30 s)
 * Range: [1 000 ms, 300 000 ms]
 *
 * Values outside the range, non-integers, infinities, and NaN all abort
 * startup so a misconfigured deployment never silently accepts stale or
 * far-future signatures.
 */
const MAX_TIMESTAMP_DRIFT_MS = validatePositiveFiniteInt(
  'MULTISIG_TIMESTAMP_DRIFT_MS',
  process.env.MULTISIG_TIMESTAMP_DRIFT_MS,
  30_000,   // default: 30 s
  1_000,    // min:     1 s
  300_000   // max:     5 min
);

/**
 * How long a consumed nonce is remembered before it can be evicted from the
 * usedNonces Map.  Must be at least MAX_TIMESTAMP_DRIFT_MS so a nonce cannot
 * be replayed after it ages out of the window but before the next cleanup.
 *
 * Env: MULTISIG_NONCE_TTL_MS  (default 3 600 000 ms = 1 h)
 * Range: [MAX_TIMESTAMP_DRIFT_MS, 86 400 000 ms (24 h)]
 */
const NONCE_TTL_MS = validatePositiveFiniteInt(
  'MULTISIG_NONCE_TTL_MS',
  process.env.MULTISIG_NONCE_TTL_MS,
  3_600_000,              // default: 1 h
  MAX_TIMESTAMP_DRIFT_MS, // min: at least the drift window
  86_400_000              // max: 24 h
);

/** Consumed nonces: nonce string → timestamp (ms) at which it was first used. */
const usedNonces = new Map();

// Startup diagnostics — visible in container/process logs so operators can
// confirm the effective values without having to read env files.
console.log(
  `[multisigService] config: MAX_TIMESTAMP_DRIFT_MS=${MAX_TIMESTAMP_DRIFT_MS} ` +
  `NONCE_TTL_MS=${NONCE_TTL_MS}`
);

// ─── Durable transaction store (MongoDB) ─────────────────────────────────────

/**
 * MultisigTransaction schema.
 *
 * Durability contract
 * ───────────────────
 *  • Every state transition (Pending → Ready → Executed / Failed) is written
 *    to MongoDB inside a session/transaction where the driver supports it.
 *  • The document is the source of truth.  The in-memory Map used previously
 *    is gone; any worker that comes up after a restart can resume from the DB.
 *  • `signatures` is an array subdocument so each approval is atomically
 *    appended with $push inside a findOneAndUpdate, preventing lost-update
 *    races under concurrent sign requests.
 *  • Owner-scoped queries are covered by the { proposer, createdAt } and
 *    { walletId, status, createdAt } indexes declared below.
 */
const SignatureSchema = new mongoose.Schema(
  {
    owner:     { type: String, required: true },
    signature: { type: String, required: true },
    timestamp: { type: Date,   default: Date.now },
  },
  { _id: false }
);

const MultisigTransactionSchema = new mongoose.Schema(
  {
    // Application-level id (keccak256 hash used as txId).
    txId:     { type: String, required: true, unique: true, index: true },
    walletId: { type: String, required: true },
    data:     { type: mongoose.Schema.Types.Mixed, required: true },
    proposer: { type: String, required: true },
    signatures: { type: [SignatureSchema], default: [] },
    status: {
      type: String,
      enum: ['Pending', 'Ready', 'Executed', 'Failed'],
      default: 'Pending',
    },
    // Replay-protection metadata stored for audit trail only.
    nonce:       { type: String },
    requestedAt: { type: Number }, // timestamp value from the proposal request (ms)
    createdAt:   { type: Date, default: Date.now },
    executedAt:  { type: Date },
    executedBy:  { type: String },
    txHash:      { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } }
);

// Covers owner-scoped queries: GET /transactions?proposer=<addr>
MultisigTransactionSchema.index({ proposer: 1, createdAt: -1 });
// Covers wallet + status list queries
MultisigTransactionSchema.index({ walletId: 1, status: 1, createdAt: -1 });

const MultisigTransaction =
  mongoose.models.MultisigTransaction ||
  mongoose.model('MultisigTransaction', MultisigTransactionSchema);

// ─── MULTISIG SERVICE ─────────────────────────────────────────────────────────

/**
 * MULTISIG SERVICE
 * Handles management of multi-signature wallets, signature collection, and transaction processing.
 *
 * Threat model (security review — issue #713):
 *  - Wallet registry (`MULTISIG_WALLETS`) is static config; the transaction store is
 *    durable MongoDB so pending/submitted work survives restarts and any worker can resume.
 *    `processTransaction` remains a stand-in for on-chain execution.
 *  - Authorization is signature-based: `collectSignature` recovers the signer from canonical
 *    EIP-712 typed data bound to chain, wallet, nonce, call target/value/calldata, and expiry.
 *    and requires it to match the claimed `owner`, who must in turn be a configured owner of
 *    the target wallet. A caller can no longer claim to be an owner by name alone — they must
 *    hold that owner's private key.
 *  - HTTP propose/execute identity is enforced in `routes/multisig.js` (issue #702).
 *  - Wallet lookup uses own-property checks so reserved keys never resolve as wallets.
 *  - `TREASURY.scheme: 'BLS'` is aspirational metadata only — verification here is ECDSA via
 *    ethers for both schemes. There is no BLS signature support in this module.
 *  - Rate limiting for the HTTP surface lives in `routes/multisig.js` (see `strictDDoSGuard`).
 */

const DEFAULT_EXPIRY_SECONDS = 60 * 60;
// Mock owner keys — non-secret, deterministic test keys (never used on any real chain)
const MOCK_OWNER_PRIVATE_KEYS = {
  OWNER_1: '0x' + '11'.repeat(32),
  OWNER_2: '0x' + '22'.repeat(32),
  OWNER_3: '0x' + '33'.repeat(32),
  ADMIN_1: '0x' + '44'.repeat(32),
  ADMIN_2: '0x' + '55'.repeat(32),
  ADMIN_3: '0x' + '66'.repeat(32),
  ADMIN_4: '0x' + '77'.repeat(32),
  ADMIN_5: '0x' + '88'.repeat(32),
};

const addressOf = (privateKey) => new ethers.Wallet(privateKey).address;

const MULTISIG_WALLETS = {
  MARKET_OPS: {
    address: '0x1234567890123456789012345678901234567890',
    owners: [
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_1),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_2),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_3),
    ],
    threshold: 2,
    scheme: 'ECDSA',
  },
  TREASURY: {
    address: '0x0987654321098765432109876543210987654321',
    owners: [
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_1),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_2),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_3),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_4),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_5),
    ],
    threshold: 3,
    scheme: 'BLS',
  },
};

/**
 * Get multisig wallet details.
 * @param {string} walletId
 * @returns {object}
 */
function getWallet(walletId) {
  if (typeof walletId !== 'string' || !Object.hasOwn(MULTISIG_WALLETS, walletId)) {
    throw new Error('Multisig wallet not found');
  }
  return MULTISIG_WALLETS[walletId];
}

/**
 * Whether `address` is a configured owner of `walletId`.
 * Invalid addresses return false rather than throwing.
 */
function isOwner(walletId, address) {
  let normalized;
  try {
    normalized = ethers.getAddress(address);
  } catch {
    return false;
  }
  try {
    return getWallet(walletId).owners.includes(normalized);
  } catch {
    return false;
  }
}

/**
 * Verify replay protection (nonce, timestamp, signature).
 * @param {string} nonce
 * @param {number} timestamp
 * @param {string} signature
 * @param {string} signer
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string, recoveredSigner?: string }}
 */
function verifyReplayProtection(nonce, timestamp, signature, signer, payload) {
  if (!nonce || typeof nonce !== 'string') {
    return { valid: false, error: 'Missing or invalid nonce' };
  }

  if (usedNonces.has(nonce)) {
    return { valid: false, error: 'Nonce already used (replay detected)' };
  }

  if (!timestamp || typeof timestamp !== 'number') {
    return { valid: false, error: 'Missing or invalid timestamp' };
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return {
      valid: false,
      error: `Timestamp drift exceeds ${MAX_TIMESTAMP_DRIFT_MS}ms`,
    };
  }

  if (!signature || typeof signature !== 'string') {
    return { valid: false, error: 'Missing or invalid signature' };
  }

  if (!signer || typeof signer !== 'string') {
    return { valid: false, error: 'Missing or invalid signer' };
  }

  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce((acc, key) => { acc[key] = payload[key]; return acc; }, {});

  const message = JSON.stringify({ payload: sortedPayload, nonce, timestamp });

  let recoveredSigner;
  try {
    recoveredSigner = ethers.verifyMessage(message, signature);
  } catch {
    return { valid: false, error: 'Invalid signature format' };
  }

  if (ethers.getAddress(recoveredSigner) !== ethers.getAddress(signer)) {
    return { valid: false, error: 'Signature signer mismatch' };
  }

  usedNonces.set(nonce, timestamp);
  return { valid: true, recoveredSigner };
}

/**
 * Evict nonces whose recorded timestamp is older than NONCE_TTL_MS.
 * Called periodically; safe to call from any worker because the authoritative
 * nonce record for replay detection is the `nonce` field on the durable DB
 * document — this Map is a fast in-process cache that supplements the DB check.
 */
function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [nonce, ts] of usedNonces.entries()) {
    if (now - ts > NONCE_TTL_MS) {
      usedNonces.delete(nonce);
    }
  }
}

setInterval(cleanupExpiredNonces, 60 * 60 * 1000);

// ─── Durable service operations ───────────────────────────────────────────────

/**
 * Propose a new multi-sig transaction and persist it to MongoDB.
 *
 * @param {string} walletId
 * @param {object} txData
 * @param {string} proposer   - checksum address (already verified by the route)
 * @param {string} [nonce]
 * @param {number} [timestamp]
 * @param {string} [signature]
 * @returns {Promise<string>} txId
 */
async function proposeTransaction(walletId, txData, proposer, nonce, timestamp, signature) {
  const wallet = getWallet(walletId);

  let normalizedProposer;
  try {
    normalizedProposer = ethers.getAddress(proposer);
  } catch {
    throw new Error('Proposer is not a valid address');
  }

  if (!wallet.owners.includes(normalizedProposer)) {
    throw new Error('Proposer is not an owner of this multisig');
  }

  // Replay protection is optional when nonce/timestamp/signature are omitted
  // (e.g. internal calls from tests). When present, all three must be valid.
  if (nonce !== undefined || timestamp !== undefined || signature !== undefined) {
    const payload = { walletId, txData, proposer };
    const replayResult = verifyReplayProtection(nonce, timestamp, signature, proposer, payload);
    if (!replayResult.valid) {
      throw new Error(`Replay protection failed: ${replayResult.error}`);
    }
  }

  const txId = ethers.id(JSON.stringify(txData) + Date.now());

const approvalNonce = await getNextPersistentNonce(boundWalletAddress);

await MultisigTransaction.create({
  txId,
  // retain main's existing fields here
  chainId: boundChainId,
  walletAddress: boundWalletAddress,
  nonce: approvalNonce,
  target,
  value,
  calldata,
  calldataHash,
  expiry,
});
    walletId,
    data: txData,
    proposer: normalizedProposer,
    signatures: [],
    status: 'Pending',
    createdAt: new Date(),
    requestNonce: nonce,
    requestedAt: timestamp,
    nonce: approvalNonce,
    chainId: boundChainId,
    walletAddress: boundWalletAddress,
    target,
    value,
    calldata,
    calldataHash,
    expiry
  });

  return txId;
}

/**
/**
 * Collect a signature for a pending transaction.
 *
 * Verifies the signer against canonical EIP-712 approval data binding the
 * chain, wallet, nonce, target, value, calldata, and expiry.
 *
 * Uses findOneAndUpdate with $push so concurrent approvals are not lost.
 * The signature must recover to a configured wallet owner.
 */
 * @param {string} txId
 * @param {string} owner
 * @param {string} signature
 * @returns {Promise<object>} the updated transaction document (plain object)
 */
async function collectSignature(txId, owner, signature) {
  // Load and validate the transaction first.
  const tx = await MultisigTransaction.findOne({ txId }).lean();
  if (!tx) throw new Error('Transaction not found');

  const wallet = getWallet(tx.walletId);

  let normalizedOwner;
  try {
    normalizedOwner = ethers.getAddress(owner);
  } catch {
    throw new Error('Owner is not a valid address');
  }

  if (!wallet.owners.includes(normalizedOwner)) {
    throw new Error('Signer is not an owner of this multisig');
  }

  if (tx.signatures.find(s => s.owner === normalizedOwner)) {
    throw new Error('Owner has already signed this transaction');
  }

  if (Math.floor(Date.now() / 1000) > tx.expiry) throw new Error('Transaction proposal has expired');
  const consumed = consumedApprovalNonces.get(tx.walletAddress.toLowerCase());
  if (tx.signatures.length === 0 && consumed?.has(tx.nonce)) {
    throw new Error('Nonce already consumed: this transaction cannot be authorized');
  }
  const { domain, types, message } = buildTypedData(tx);
  verifyTypedDataSignature(domain, types, message, signature, normalizedOwner);

  const updatedTx = await MultisigTransaction.findOneAndUpdate(
    {
      txId,
      status: 'Pending',
      signatures: {
        $not: { $elemMatch: { owner: normalizedOwner } },
      },
    },
    {
      $push: {
        signatures: {
          owner: normalizedOwner,
          signature,
          timestamp: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!updatedTx) {
    throw new Error('Owner has already signed this transaction or it is no longer pending');
  }
  }

  // Atomically append the new signature and, if threshold is now met, flip status.
  const newSigCount = tx.signatures.length + 1;
  const newStatus = newSigCount >= wallet.threshold ? 'Ready' : 'Pending';

  const updated = await MultisigTransaction.findOneAndUpdate(
    {
      txId,
      // Guard: still at the count we read — prevents a race where two signers
      // both read length N and both try to push the N+1-th approval.
      $expr: { $eq: [{ $size: '$signatures' }, tx.signatures.length] },
      // Also guard: this owner has not signed yet.
      'signatures.owner': { $ne: normalizedOwner },
    },
    {
      $push: {
        signatures: {
          owner: normalizedOwner,
          signature,
          timestamp: new Date(),
        },
      },
      $set: { status: newStatus },
    },
    { new: true }
  ).lean();

  if (!updated) {
    // Either the count changed (concurrent sign) or this owner already signed.
    // Re-fetch to give the caller an accurate document and a meaningful error.
    const current = await MultisigTransaction.findOne({ txId }).lean();
    if (current && current.signatures.find((s) => s.owner === normalizedOwner)) {
      throw new Error('Owner has already signed this transaction');
    }
    throw new Error('Transaction was concurrently modified; please retry');
  }

  return updated;
}

/**
 * Execute a multi-sig transaction that has reached threshold.
 *
 * @param {string} txId
 * @param {string} [executor] - owner address; required when called from HTTP route
 * @returns {Promise<object>} the updated transaction document (plain object)
 */
async function processTransaction(txId, executor) {
  const tx = await MultisigTransaction.findOne({ txId }).lean();
  if (!tx) throw new Error('Transaction not found');

  const wallet = getWallet(tx.walletId);

  if (Math.floor(Date.now() / 1000) > tx.expiry) {
    throw new Error('Transaction proposal has expired');
  }

  let normalizedExecutor;
  if (executor !== undefined) {
    try {
      normalizedExecutor = ethers.getAddress(executor);
    } catch {
      throw new Error('Executor is not a valid address');
    }
    if (!wallet.owners.includes(normalizedExecutor)) {
      throw new Error('Executor is not an owner of this multisig');
    }
  }

  if (tx.signatures.length < wallet.threshold) {
    throw new Error(
      `Insufficient signatures. Required: ${wallet.threshold}, Current: ${tx.signatures.length}`
    );
  }

  if (normalizedExecutor && !wallet.owners.includes(normalizedExecutor)) {
    throw new Error('Executor is not an owner of this multisig');
  }

  console.log(`[multisigService] executing txId=${txId} walletId=${tx.walletId}`);

  // Placeholder for on-chain broadcast; generate deterministic mock hash.
  const mockTxHash = '0x' + ethers.id(txId + Date.now()).slice(2, 66);

  const updated = await MultisigTransaction.findOneAndUpdate(
    { txId, status: { $in: ['Pending', 'Ready'] } },
    {
      $set: {
        status: 'Executed',
        executedAt: new Date(),
        executedBy: normalizedExecutor || null,
        txHash: mockTxHash,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    // Concurrent execute or wrong status — re-fetch for a clean error.
    const current = await MultisigTransaction.findOne({ txId }).lean();
    if (current && current.status === 'Executed') {
      throw new Error('Transaction has already been executed');
    }
    throw new Error('Transaction could not be executed; check status and signatures');
  }

  return updated;
}

/**
 * Retrieve the current status of a transaction from the durable store.
 *
 * @param {string} txId
 * @returns {Promise<object>} plain transaction document
 */
async function getTransactionStatus(txId) {
  const tx = await MultisigTransaction.findOne({ txId }).lean();
  if (!tx) throw new Error('Transaction not found');
  return tx;
}

// ---------------------------------------------------------------------------
// #1198 – EIP-712 typed-data constants and helpers
// ---------------------------------------------------------------------------

const MULTISIG_DOMAIN_NAME = 'GateDelay MultiSig';
const MULTISIG_DOMAIN_VERSION = '1';

/** EIP-712 type definition for a multisig approval. */
const MULTISIG_APPROVAL_TYPES = {
  MultisigApproval: [
    { name: 'chainId', type: 'uint256' },
    { name: 'walletAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'calldataHash', type: 'bytes32' },
    { name: 'expiry', type: 'uint256' },
  ],
};

/**
 * Build the EIP-712 domain for a multisig transaction.
 * @param {object} tx
 * @returns {object}
 */
function buildDomain(tx) {
  const wallet = MULTISIG_WALLETS[tx.walletId];
  return {
    name: MULTISIG_DOMAIN_NAME,
    version: MULTISIG_DOMAIN_VERSION,
    chainId: tx.chainId,
    verifyingContract: tx.walletAddress || (wallet ? wallet.address : tx.target),
  };
}

/**
 * Build the EIP-712 message for a multisig transaction.
 * @param {object} tx
 * @returns {object}
 */
function buildMessage(tx) {
  const wallet = MULTISIG_WALLETS[tx.walletId];
  return {
    chainId: tx.chainId,
    walletAddress: tx.walletAddress || (wallet ? wallet.address : tx.target),
    nonce: tx.nonce !== undefined ? tx.nonce : 0,
    target: tx.target || (wallet ? wallet.address : ethers.ZeroAddress),
    value: tx.value ? String(tx.value) : '0',
    calldataHash: tx.calldataHash || ethers.keccak256('0x'),
    expiry: tx.expiry !== undefined ? tx.expiry : 0,
  };
}

/**
 * Return the full EIP-712 typed-data object for a transaction.
 * @param {object} tx
 * @returns {object}
 */
function buildTypedData(tx) {
  return {
    domain: buildDomain(tx),
    types: MULTISIG_APPROVAL_TYPES,
    message: buildMessage(tx),
  };
}

/**
 * Compute the EIP-712 hash of the typed data for a transaction.
 * @param {object} tx
 * @returns {string}
 */
function buildTypedDataHash(tx) {
  const { domain, types, message } = buildTypedData(tx);
  return ethers.TypedDataEncoder.hash(domain, types, message);
}

/**
 * Verify an EIP-712 signature against the expected owner.
 * @param {object} domain
 * @param {object} types
 * @param {object} message
 * @param {string} signature
 * @param {string} expectedOwner
 */
function verifyTypedDataSignature(domain, types, message, signature, expectedOwner) {
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error(
      'Invalid signature format: expected a 65-byte (130 hex char) EIP-712 signature',
    );
  }

  let recovered;
  try {
    recovered = ethers.verifyTypedData(domain, types, message, signature);
  } catch {
    throw new Error('Signature recovery failed: malformed or invalid signature');
  }

  if (recovered.toLowerCase() !== expectedOwner.toLowerCase()) {
    throw new Error(
      `Signature verification failed: recovered ${recovered} but expected ${expectedOwner}`,
    );
  }
}

/**
 * List transactions scoped to a proposer address (owner view) or walletId.
 *
 * Pagination is offset-based (page / limit) consistent with the rest of the
 * service layer, and results are sorted newest-first.
 *
 * @param {object} filter
 * @param {string} [filter.proposer] - filter by proposer address
 * @param {string} [filter.walletId] - filter by wallet
 * @param {string} [filter.status] - filter by status
 * @param {object} [pagination]
 * @param {number} [pagination.page] - 1-indexed (default 1)
 * @param {number} [pagination.limit] - items per page (default 20, max 100)
 * @returns {Promise<object>} { data, total, page, limit, totalPages }
 */
async function listTransactions(filter = {}, pagination = {}) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(pagination.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const query = {};
  if (filter.proposer) {
    try {
      query.proposer = ethers.getAddress(filter.proposer);
    } catch {
      throw new Error('Invalid proposer address');
    }
  }

  if (filter.walletId) {
    if (
      typeof filter.walletId !== 'string' ||
      !Object.hasOwn(MULTISIG_WALLETS, filter.walletId)
    ) {
      throw new Error('Multisig wallet not found');
    }
    query.walletId = filter.walletId;
  }

  if (filter.status) {
    query.status = filter.status;
  }

  const [data, total] = await Promise.all([
    MultisigTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MultisigTransaction.countDocuments(query),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
module.exports = {
  MULTISIG_DOMAIN_NAME,
  MULTISIG_DOMAIN_VERSION,
  MULTISIG_APPROVAL_TYPES,
  buildDomain,
  buildMessage,
  buildTypedData,
  buildTypedDataHash,
  verifyTypedDataSignature,
  getWallet,
  isOwner,
  proposeTransaction,
  collectSignature,
  processTransaction,
  getTransactionStatus,
  listTransactions,
  verifyReplayProtection,
  cleanupExpiredNonces,
  // Exported for testing
  MultisigTransaction,
  MAX_TIMESTAMP_DRIFT_MS,
  NONCE_TTL_MS,
};
