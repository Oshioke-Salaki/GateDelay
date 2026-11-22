const { ethers } = require('ethers');
const breakerService = require('./breakerService');

/**
 * BRIDGE SERVICE
 * Handles cross-chain asset bridging operations across multiple bridge protocols.
 *
 * Responsibilities:
 *  - Support multiple bridge protocols (LayerZero, Wormhole, Axelar)
 *  - Handle bridge transaction processing
 *  - Track bridge status and confirmations
 *  - Provide bridge analytics
 *  - Manage bridge security (limits, allow-listed chains/tokens, validation)
 *
 * In-memory stores are used for simulation. In production these would be backed
 * by Mongoose models and on-chain reads via ethers providers.
 */

// ─── Retention / pagination configuration ────────────────────────────────────

/**
 * Maximum number of transfers kept in the hot Map at once.
 *
 * Env: BRIDGE_MAX_TRANSFERS  (default 10 000)
 * Range: [100, 1 000 000]
 *
 * When the cap is reached, finalized (Completed / Failed) entries are evicted
 * oldest-first into the archive Map before the new entry is inserted.
 * Pending / Confirming entries are never automatically evicted so in-flight
 * work is never lost from the hot store.
 */
const _rawMaxTransfers = process.env.BRIDGE_MAX_TRANSFERS;
const _parsedMaxTransfers = _rawMaxTransfers === undefined || _rawMaxTransfers === ''
  ? 10_000
  : Number(_rawMaxTransfers);

if (
  !Number.isFinite(_parsedMaxTransfers) ||
  !Number.isInteger(_parsedMaxTransfers) ||
  _parsedMaxTransfers < 100 ||
  _parsedMaxTransfers > 1_000_000
) {
  throw new Error(
    `[bridgeService] BRIDGE_MAX_TRANSFERS must be an integer in [100, 1 000 000]; ` +
    `got ${JSON.stringify(_rawMaxTransfers)}`
  );
}

const MAX_TRANSFERS_IN_MEMORY = _parsedMaxTransfers;

/**
 * Archive retention window.
 *
 * Env: BRIDGE_ARCHIVE_RETENTION_MS  (default 7 days)
 * Range: [60 000 ms (1 min), 31 536 000 000 ms (365 days)]
 *
 * Archived entries older than this window are eligible for permanent removal
 * on the next archive sweep (see cleanupArchive).  In production the sweep
 * would instead move them to cold storage (S3, a data warehouse, etc.).
 */
const _rawArchiveRetention = process.env.BRIDGE_ARCHIVE_RETENTION_MS;
const _parsedArchiveRetention = _rawArchiveRetention === undefined || _rawArchiveRetention === ''
  ? 7 * 24 * 60 * 60 * 1000   // 7 days
  : Number(_rawArchiveRetention);

if (
  !Number.isFinite(_parsedArchiveRetention) ||
  !Number.isInteger(_parsedArchiveRetention) ||
  _parsedArchiveRetention < 60_000 ||
  _parsedArchiveRetention > 31_536_000_000
) {
  throw new Error(
    `[bridgeService] BRIDGE_ARCHIVE_RETENTION_MS must be an integer in ` +
    `[60 000, 31 536 000 000]; got ${JSON.stringify(_rawArchiveRetention)}`
  );
}

const ARCHIVE_RETENTION_MS = _parsedArchiveRetention;

/** Maximum page size callers can request for list / archive endpoints. */
const MAX_PAGE_SIZE = 200;
/** Default page size when the caller omits `limit`. */
const DEFAULT_PAGE_SIZE = 50;

console.log(
  `[bridgeService] config: MAX_TRANSFERS_IN_MEMORY=${MAX_TRANSFERS_IN_MEMORY} ` +
  `ARCHIVE_RETENTION_MS=${ARCHIVE_RETENTION_MS}`
);

// ─── In-memory stores ─────────────────────────────────────────────────────────

/**
 * Hot store: active, confirming, and recently finalized transfers.
 * Insertion order is preserved (Map guarantees this in V8), which is the
 * foundation of the cursor-pagination sort.
 */
const transfers = new Map();

/**
 * Archive store: finalized transfers evicted from the hot Map.
 *
 * Retention contract
 * ──────────────────
 *  • An entry is moved here when the hot Map exceeds MAX_TRANSFERS_IN_MEMORY
 *    and it is in a terminal state (Completed or Failed).
 *  • Entries are retrievable via getArchivedTransfer / listArchivedTransfers
 *    for up to ARCHIVE_RETENTION_MS after their updatedAt timestamp.
 *  • After that window they are eligible for removal by cleanupArchive().
 *    In production, cleanupArchive() should flush them to cold storage
 *    (object store, data warehouse) before deleting from this Map.
 *  • The archive is never the primary lookup target: callers must explicitly
 *    use the archive endpoints; ordinary getTransfer only searches the hot Map.
 */
const archivedTransfers = new Map();

// ─── Eviction helpers ─────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(['Completed', 'Failed']);

/**
 * Evict the oldest finalized entries from the hot Map until its size is below
 * MAX_TRANSFERS_IN_MEMORY.  Evicted entries move to archivedTransfers.
 *
 * Called automatically before every new insertion.
 */
function evictToArchive() {
  if (transfers.size < MAX_TRANSFERS_IN_MEMORY) return;

  // Collect finalized entries in insertion order (oldest first via Map iteration).
  const evictable = [];
  for (const [id, t] of transfers) {
    if (TERMINAL_STATUSES.has(t.status)) evictable.push(id);
  }

  // Evict oldest-first until we have room for one new entry.
  const toRemove = transfers.size - MAX_TRANSFERS_IN_MEMORY + 1;
  for (let i = 0; i < Math.min(toRemove, evictable.length); i++) {
    const id = evictable[i];
    archivedTransfers.set(id, transfers.get(id));
    transfers.delete(id);
  }
}

/**
 * Remove archive entries whose updatedAt is older than ARCHIVE_RETENTION_MS.
 * In production: flush to cold storage before deleting.
 * Called by the periodic cleanup interval (every hour).
 */
function cleanupArchive() {
  const cutoff = Date.now() - ARCHIVE_RETENTION_MS;
  let removed = 0;
  for (const [id, t] of archivedTransfers) {
    if (new Date(t.updatedAt).getTime() < cutoff) {
      // TODO (production): write t to cold storage before deleting.
      archivedTransfers.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[bridgeService] archive cleanup: removed ${removed} expired entries`);
  }
}

setInterval(cleanupArchive, 60 * 60 * 1000); // run hourly

/**
 * Supported bridge protocols and the chains they route between.
 * `confirmations` is the number of source-chain confirmations required before
 * a transfer is considered finalized on the destination chain.
 */
const PROTOCOLS = {
  LAYERZERO: {
    name: 'LAYERZERO',
    chains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc'],
    confirmations: 12,
  },
  WORMHOLE: {
    name: 'WORMHOLE',
    chains: ['ethereum', 'solana', 'polygon', 'bsc', 'avalanche'],
    confirmations: 15,
  },
  AXELAR: {
    name: 'AXELAR',
    chains: ['ethereum', 'polygon', 'avalanche', 'fantom', 'moonbeam'],
    confirmations: 10,
  },
};

const TRANSFER_STATUS = {
  PENDING: 'Pending',
  CONFIRMING: 'Confirming',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

/**
 * Security parameters. Caps and allow-lists guard against draining and against
 * routing unsupported assets/chains.
 */
const SECURITY = {
  // Max single-transfer notional (in token units) permitted through the bridge.
  MAX_TRANSFER_AMOUNT: 1_000_000,
  // Tokens allowed to be bridged.
  ALLOWED_TOKENS: ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC'],
};

// ─── Transaction hash validation + on-chain intent verification ──────────────

/**
 * A valid EVM transaction hash: exactly "0x" followed by 64 lowercase hex chars.
 * Uppercase is rejected — normalise to lowercase before calling if needed.
 */
const TX_HASH_RE = /^0x[0-9a-f]{64}$/;

/**
 * Assert that `hash` is a well-formed EVM transaction hash.
 * Throws a descriptive error on any violation so an arbitrary string can
 * never silently pass through as a hash.
 *
 * @param {string} hash
 * @param {string} [field] - field name for the error message
 */
function validateTxHash(hash, field = 'txHash') {
  if (typeof hash !== 'string') {
    throw new Error(`${field} must be a string; got ${typeof hash}`);
  }
  if (!TX_HASH_RE.test(hash)) {
    throw new Error(
      `${field} must be a 0x-prefixed 64-character lowercase hex string; got "${hash}"`
    );
  }
}

/**
 * ERC-20 Transfer(address indexed from, address indexed to, uint256 value) topic.
 * Computed once at startup to avoid repeated keccak calls.
 */
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/**
 * ERC-20 token contract addresses for the tokens this bridge supports.
 *
 * In production these would come from a per-chain config / registry.
 * Keyed as `token_symbol:chain` → checksummed contract address.
 *
 * Chains without a configured address for a given token fall back to
 * native-value matching (used for WETH on chains where it is the gas token).
 */
const TOKEN_CONTRACTS = {
  // ── Ethereum mainnet ────────────────────────────────────────────────────
  'USDC:ethereum':  ethers.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  'USDT:ethereum':  ethers.getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  'DAI:ethereum':   ethers.getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  'WETH:ethereum':  ethers.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  'WBTC:ethereum':  ethers.getAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
  // ── Arbitrum ────────────────────────────────────────────────────────────
  'USDC:arbitrum':  ethers.getAddress('0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'),
  'USDT:arbitrum':  ethers.getAddress('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
  'WETH:arbitrum':  ethers.getAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'),
  // ── Polygon ─────────────────────────────────────────────────────────────
  'USDC:polygon':   ethers.getAddress('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'),
  'USDT:polygon':   ethers.getAddress('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  'WETH:polygon':   ethers.getAddress('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'),
};

/**
 * Fetch a transaction + receipt and verify it matches the immutable intent
 * fields of `transfer`.
 *
 * Checks (all must pass):
 *  1. Transaction exists on the expected chain.
 *  2. Receipt status = 1 (not reverted).
 *  3. `tx.from` matches `transfer.sender` (checksummed).
 *  4. For ERC-20 tokens: `tx.to` matches the known token contract; a
 *     Transfer(from, to, value) log exists where `from` = sender,
 *     `to` = recipient, `value` ≥ transfer.amount (in token units × 1e6
 *     for USDC/USDT, 1e18 for others — see TOKEN_DECIMALS below).
 *  5. For native transfers (no token contract on this chain): `tx.to`
 *     matches `transfer.recipient` and `tx.value` ≥ transfer.amount (wei).
 *
 * A successful but unrelated transaction will fail check 3, 4, or 5 and
 * is rejected with a descriptive error — it can never confirm a transfer.
 *
 * @param {object} transfer   - the immutable intent record
 * @param {string} hash       - pre-validated 0x-hex tx hash
 * @param {'source'|'dest'} role - which leg of the bridge this hash covers
 * @param {ethers.Provider} provider - connected to the relevant chain
 * @throws {Error} with code property on any mismatch
 */
async function verifyTxHashAgainstIntent(transfer, hash, role, provider) {
  // 1. Fetch tx and receipt in parallel.
  let onChainTx, receipt;
  try {
    [onChainTx, receipt] = await Promise.all([
      provider.getTransaction(hash),
      provider.getTransactionReceipt(hash),
    ]);
  } catch (err) {
    const e = new Error(`Failed to fetch transaction ${hash}: ${err.message}`);
    e.code = 'TX_FETCH_ERROR';
    throw e;
  }

  if (!onChainTx) {
    const e = new Error(`Transaction ${hash} not found on chain`);
    e.code = 'TX_NOT_FOUND';
    throw e;
  }

  // 2. Receipt must exist and be successful.
  if (!receipt) {
    const e = new Error(`Receipt for ${hash} not yet available (transaction may be pending)`);
    e.code = 'TX_PENDING';
    throw e;
  }
  if (receipt.status !== 1) {
    const e = new Error(`Transaction ${hash} was reverted (status=0)`);
    e.code = 'TX_REVERTED';
    throw e;
  }

  // Determine the relevant addresses for this role.
  // For 'source' the sender is transfer.sender; for 'dest' the relayer
  // address is not known at intent-creation time, so we skip the `from`
  // check on the destination leg and only verify recipient + value.
  const chain = role === 'source' ? transfer.sourceChain : transfer.destChain;
  const expectedRecipient = ethers.getAddress(transfer.recipient);
  const expectedSender    = ethers.isAddress(transfer.sender)
    ? ethers.getAddress(transfer.sender)
    : null;

  // 3. Sender check (source leg only).
  if (role === 'source' && expectedSender) {
    const actualFrom = ethers.getAddress(onChainTx.from);
    if (actualFrom !== expectedSender) {
      const e = new Error(
        `Sender mismatch: expected ${expectedSender} but transaction was sent by ${actualFrom}`
      );
      e.code = 'TX_SENDER_MISMATCH';
      throw e;
    }
  }

  const tokenKey = `${transfer.token}:${chain}`;
  const tokenContract = TOKEN_CONTRACTS[tokenKey] || null;

  if (tokenContract) {
    // ── ERC-20 path ─────────────────────────────────────────────────────

    // 4a. The transaction must have been sent to the token contract.
    if (!onChainTx.to || ethers.getAddress(onChainTx.to) !== tokenContract) {
      const e = new Error(
        `Token contract mismatch: expected call to ${tokenContract} ` +
        `(${transfer.token} on ${chain}) but tx.to is ${onChainTx.to}`
      );
      e.code = 'TX_TOKEN_MISMATCH';
      throw e;
    }

    // 4b. Find a Transfer log from the token contract that moves the right
    //     amount to the right recipient.
    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address &&
        ethers.getAddress(log.address) === tokenContract &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );

    if (transferLogs.length === 0) {
      const e = new Error(
        `No ERC-20 Transfer event found from ${tokenContract} in receipt for ${hash}`
      );
      e.code = 'TX_NO_TRANSFER_EVENT';
      throw e;
    }

    // Token decimals: USDC and USDT use 6; everything else uses 18.
    const TOKEN_DECIMALS = { USDC: 6, USDT: 6 };
    const decimals = TOKEN_DECIMALS[transfer.token] ?? 18;
    // Minimum expected value in token-native units (no floating-point math).
    const expectedValueWei = BigInt(
      Math.floor(transfer.amount * 10 ** decimals)
    );

    // Accept the first log that matches sender → recipient with sufficient value.
    const matchingLog = transferLogs.find((log) => {
      try {
        // topics[1] = from (padded address), topics[2] = to (padded address)
        const logFrom = ethers.getAddress('0x' + log.topics[1].slice(26));
        const logTo   = ethers.getAddress('0x' + log.topics[2].slice(26));
        const logValue = BigInt(log.data);

        const senderOk = role === 'dest'
          ? true  // dest relayer address is not constrained
          : expectedSender ? logFrom === expectedSender : true;

        return senderOk && logTo === expectedRecipient && logValue >= expectedValueWei;
      } catch {
        return false;
      }
    });

    if (!matchingLog) {
      const e = new Error(
        `No matching ERC-20 Transfer found: expected ${transfer.token} transfer ` +
        `to ${expectedRecipient} of at least ${transfer.amount} ` +
        `(${expectedValueWei} base units)`
      );
      e.code = 'TX_TRANSFER_MISMATCH';
      throw e;
    }
  } else {
    // ── Native-value path ───────────────────────────────────────────────

    // 5a. Transaction must be sent directly to the recipient.
    if (!onChainTx.to || ethers.getAddress(onChainTx.to) !== expectedRecipient) {
      const e = new Error(
        `Recipient mismatch: expected ${expectedRecipient} but tx.to is ${onChainTx.to}`
      );
      e.code = 'TX_RECIPIENT_MISMATCH';
      throw e;
    }

    // 5b. Native value must cover the transfer amount.
    const expectedWei = ethers.parseEther(String(transfer.amount));
    const actualWei   = BigInt(onChainTx.value ?? 0);
    if (actualWei < expectedWei) {
      const e = new Error(
        `Amount mismatch: expected at least ${expectedWei} wei ` +
        `but transaction carries ${actualWei} wei`
      );
      e.code = 'TX_AMOUNT_MISMATCH';
      throw e;
    }
  }
}

/**
 * Validate the integrity and safety of a bridge request before processing.
 * Throws on the first violation.
 * @param {object} params
 */
function validateTransfer({ protocol, sourceChain, destChain, token, amount, recipient }) {
  const proto = PROTOCOLS[protocol];
  if (!proto) {
    throw new Error(`Unsupported bridge protocol: ${protocol}`);
  }

  if (!sourceChain || !destChain) {
    throw new Error('Both sourceChain and destChain are required');
  }
  if (sourceChain === destChain) {
    throw new Error('sourceChain and destChain must differ');
  }
  if (!proto.chains.includes(sourceChain)) {
    throw new Error(`${protocol} does not support source chain ${sourceChain}`);
  }
  if (!proto.chains.includes(destChain)) {
    throw new Error(`${protocol} does not support destination chain ${destChain}`);
  }

  if (!token || !SECURITY.ALLOWED_TOKENS.includes(token)) {
    throw new Error(`Token not allowed for bridging: ${token}`);
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid bridge amount: ${amount}`);
  }
  if (value > SECURITY.MAX_TRANSFER_AMOUNT) {
    throw new Error(`Amount exceeds bridge limit of ${SECURITY.MAX_TRANSFER_AMOUNT}`);
  }

  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }
}

/**
 * Initiate a cross-chain bridge transfer.
 * @param {object} params
 * @param {string} params.protocol - One of PROTOCOLS keys
 * @param {string} params.sourceChain
 * @param {string} params.destChain
 * @param {string} params.token - Symbol from SECURITY.ALLOWED_TOKENS
 * @param {number|string} params.amount
 * @param {string} params.sender
 * @param {string} params.recipient - Destination address
 * @returns {Promise<object>} the created transfer record
 */
async function initiateTransfer(params, options = {}) {
  validateTransfer(params);

  const serviceName = params.protocol ? `bridge-${params.protocol.toLowerCase()}` : 'bridge-service';

  const defaultFallback = async (err) => {
    const proto = PROTOCOLS[params.protocol];
    const transferId = 'brg_fb_' + Math.random().toString(36).substr(2, 9);
    const fallbackTransfer = {
      id: transferId,
      protocol: proto ? proto.name : params.protocol,
      sourceChain: params.sourceChain,
      destChain: params.destChain,
      token: params.token,
      amount: Number(params.amount),
      sender: params.sender,
      recipient: params.recipient,
      status: TRANSFER_STATUS.FAILED,
      failureReason: `Fallback: ${err.message}`,
      isFallback: true,
      circuitState: err.code === 'CIRCUIT_BREAKER_OPEN' ? 'OPEN' : 'DEGRADED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    evictToArchive();
    transfers.set(transferId, fallbackTransfer);
    return fallbackTransfer;
  };

  const fallbackHandler = options.fallback || (options.useFallback ? defaultFallback : undefined);

  return breakerService.executeWithBreaker(
    serviceName,
    async () => {
      const proto = PROTOCOLS[params.protocol];
      const transferId = 'brg_' + Math.random().toString(36).substr(2, 9);

      const transfer = {
        id: transferId,
        protocol: proto.name,
        sourceChain: params.sourceChain,
        destChain: params.destChain,
        token: params.token,
        amount: Number(params.amount),
        sender: params.sender,
        recipient: params.recipient,
        status: TRANSFER_STATUS.PENDING,
        confirmations: 0,
        requiredConfirmations: proto.confirmations,
        sourceTxHash: null,
        destTxHash: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      evictToArchive();
      transfers.set(transferId, transfer);
      return transfer;
    },
    {
      timeoutMs: options.timeoutMs || 10000,
      fallback: fallbackHandler,
    }
  );
}

/**
 * Record source-chain confirmations for a transfer and advance its status.
 *
 * When `sourceTxHash` or `destTxHash` is provided the hash is:
 *  1. Validated for format (0x + 64 lowercase hex chars).
 *  2. Fetched from the chain (when a provider is available via
 *     `options.provider`; skipped in unit-test / provider-less environments).
 *  3. Matched against the immutable transfer intent — sender, recipient,
 *     token, and amount must all agree before the hash is accepted.
 *
 * A successful but unrelated transaction can never confirm a withdrawal
 * because the intent fields are checked against on-chain data, not just
 * the receipt status.
 *
 * @param {string} transferId
 * @param {number} confirmations - Latest observed source-chain confirmations
 * @param {object} [tx] - { sourceTxHash?, destTxHash?, provider? }
 *   provider - ethers.Provider instance; when omitted hash format is still
 *              validated but on-chain verification is skipped.
 * @returns {Promise<object>} the updated transfer record
 */
async function updateConfirmations(transferId, confirmations, tx = {}) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status === TRANSFER_STATUS.COMPLETED) {
    throw new Error('Transfer already completed');
  }
  if (transfer.status === TRANSFER_STATUS.FAILED) {
    throw new Error('Transfer has failed');
  }

  const count = Number(confirmations);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error(`Invalid confirmation count: ${confirmations}`);
  }

  // ── tx hash validation ──────────────────────────────────────────────────
  if (tx.sourceTxHash !== undefined && tx.sourceTxHash !== null) {
    validateTxHash(tx.sourceTxHash, 'sourceTxHash');
    if (tx.provider) {
      await verifyTxHashAgainstIntent(transfer, tx.sourceTxHash, 'source', tx.provider);
    }
    transfer.sourceTxHash = tx.sourceTxHash;
  }
  if (tx.destTxHash !== undefined && tx.destTxHash !== null) {
    validateTxHash(tx.destTxHash, 'destTxHash');
    if (tx.provider) {
      await verifyTxHashAgainstIntent(transfer, tx.destTxHash, 'dest', tx.provider);
    }
    transfer.destTxHash = tx.destTxHash;
  }

  transfer.confirmations = count;

  if (count >= transfer.requiredConfirmations) {
    transfer.status = TRANSFER_STATUS.COMPLETED;
  } else if (count > 0) {
    transfer.status = TRANSFER_STATUS.CONFIRMING;
  }

  transfer.updatedAt = new Date().toISOString();
  return transfer;
}

/**
 * Mark a transfer as failed (e.g. relayer timeout, revert on destination).
 * @param {string} transferId
 * @param {string} [reason]
 * @returns {Promise<object>} the updated transfer record
 */
async function failTransfer(transferId, reason = 'Unknown error') {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status === TRANSFER_STATUS.COMPLETED) {
    throw new Error('Cannot fail a completed transfer');
  }

  transfer.status = TRANSFER_STATUS.FAILED;
  transfer.failureReason = reason;
  transfer.updatedAt = new Date().toISOString();
  return transfer;
}

/**
 * Fetch the current status of a transfer.
 * @param {string} transferId
 * @returns {Promise<object>}
 */
async function getTransfer(transferId) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error('Transfer not found');
  return transfer;
}

/**
 * List transfers with stable cursor pagination and optional filters.
 *
 * Cursor scheme
 * ─────────────
 * The cursor encodes the `createdAt` ISO timestamp and `id` of the *last*
 * item on the previous page, base64url-encoded as JSON.  On the next call
 * the server positions the result set to entries strictly *after* that point
 * using a (createdAt DESC, id DESC) ordering so pages are stable even when
 * new transfers are inserted between requests.
 *
 * @param {object} [filter] - { status, protocol, sender }
 * @param {object} [pagination] - { limit, cursor, direction }
 *   limit     - items per page; capped at MAX_PAGE_SIZE (default DEFAULT_PAGE_SIZE)
 *   cursor    - opaque string returned as `nextCursor` on the previous page
 *   direction - 'next' (default) | 'prev'  (reserved for future bidirectional paging)
 * @returns {Promise<object>} { data: transfer[], nextCursor: string|null, total: number }
 */
async function listTransfers(filter = {}, pagination = {}) {
  // Resolve and validate limit.
  const rawLimit = pagination.limit;
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== undefined && rawLimit !== null) {
    const n = Number(rawLimit);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid pagination limit: ${rawLimit}`);
    }
    limit = Math.min(Math.ceil(n), MAX_PAGE_SIZE);
  }

  // Decode cursor if supplied.
  let cursorCreatedAt = null;
  let cursorId = null;
  if (pagination.cursor) {
    try {
      const decoded = JSON.parse(
        Buffer.from(pagination.cursor, 'base64url').toString('utf8')
      );
      cursorCreatedAt = decoded.createdAt;
      cursorId = decoded.id;
      if (!cursorCreatedAt || !cursorId) throw new Error('incomplete');
    } catch {
      throw new Error('Invalid pagination cursor');
    }
  }

  // Apply filters.
  let results = Array.from(transfers.values());
  if (filter.status) results = results.filter((t) => t.status === filter.status);
  if (filter.protocol) results = results.filter((t) => t.protocol === filter.protocol);
  if (filter.sender) results = results.filter((t) => t.sender === filter.sender);

  // Sort newest-first (primary: createdAt DESC, secondary: id DESC for ties).
  results.sort((a, b) => {
    const dt = new Date(b.createdAt) - new Date(a.createdAt);
    if (dt !== 0) return dt;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });

  const total = results.length;

  // Apply cursor — skip all items that are "at or before" the cursor position.
  if (cursorCreatedAt !== null) {
    const cursorMs = new Date(cursorCreatedAt).getTime();
    const startIdx = results.findIndex((t) => {
      const tMs = new Date(t.createdAt).getTime();
      if (tMs < cursorMs) return true;
      if (tMs === cursorMs && t.id <= cursorId) return true;
      return false;
    });
    results = startIdx === -1 ? [] : results.slice(startIdx);
  }

  // Take the page.
  const page = results.slice(0, limit);

  // Build nextCursor from the last item on this page.
  let nextCursor = null;
  if (page.length === limit && results.length > limit) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ createdAt: last.createdAt, id: last.id }),
      'utf8'
    ).toString('base64url');
  }

  return { data: page, nextCursor, total };
}

/**
 * Retrieve a single archived transfer by id.
 * @param {string} transferId
 * @returns {Promise<object>}
 */
async function getArchivedTransfer(transferId) {
  const t = archivedTransfers.get(transferId);
  if (!t) throw new Error('Archived transfer not found');
  return t;
}

/**
 * List archived transfers with cursor pagination and optional status / sender
 * filters.  Follows the same cursor contract as listTransfers.
 *
 * Retention note: entries are present here for up to ARCHIVE_RETENTION_MS
 * after their `updatedAt`.  After that they are removed by cleanupArchive().
 *
 * @param {object} [filter] - { status, protocol, sender }
 * @param {object} [pagination] - { limit, cursor }
 * @returns {Promise<object>} { data: transfer[], nextCursor: string|null, total: number }
 */
async function listArchivedTransfers(filter = {}, pagination = {}) {
  const rawLimit = pagination.limit;
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== undefined && rawLimit !== null) {
    const n = Number(rawLimit);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid pagination limit: ${rawLimit}`);
    }
    limit = Math.min(Math.ceil(n), MAX_PAGE_SIZE);
  }

  let cursorCreatedAt = null;
  let cursorId = null;
  if (pagination.cursor) {
    try {
      const decoded = JSON.parse(
        Buffer.from(pagination.cursor, 'base64url').toString('utf8')
      );
      cursorCreatedAt = decoded.createdAt;
      cursorId = decoded.id;
      if (!cursorCreatedAt || !cursorId) throw new Error('incomplete');
    } catch {
      throw new Error('Invalid pagination cursor');
    }
  }

  let results = Array.from(archivedTransfers.values());
  if (filter.status) results = results.filter((t) => t.status === filter.status);
  if (filter.protocol) results = results.filter((t) => t.protocol === filter.protocol);
  if (filter.sender) results = results.filter((t) => t.sender === filter.sender);

  results.sort((a, b) => {
    const dt = new Date(b.createdAt) - new Date(a.createdAt);
    if (dt !== 0) return dt;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });

  const total = results.length;

  if (cursorCreatedAt !== null) {
    const cursorMs = new Date(cursorCreatedAt).getTime();
    const startIdx = results.findIndex((t) => {
      const tMs = new Date(t.createdAt).getTime();
      if (tMs < cursorMs) return true;
      if (tMs === cursorMs && t.id <= cursorId) return true;
      return false;
    });
    results = startIdx === -1 ? [] : results.slice(startIdx);
  }

  const page = results.slice(0, limit);

  let nextCursor = null;
  if (page.length === limit && results.length > limit) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ createdAt: last.createdAt, id: last.id }),
      'utf8'
    ).toString('base64url');
  }

  return { data: page, nextCursor, total };
}

/**
 * Aggregate analytics across all bridge transfers.
 * @returns {Promise<object>}
 */
async function getBridgeAnalytics() {
  const all = Array.from(transfers.values());
  const completed = all.filter((t) => t.status === TRANSFER_STATUS.COMPLETED);
  const failed = all.filter((t) => t.status === TRANSFER_STATUS.FAILED);

  const volumeByProtocol = {};
  const volumeByToken = {};
  let totalVolume = 0;

  for (const t of completed) {
    totalVolume += t.amount;
    volumeByProtocol[t.protocol] = (volumeByProtocol[t.protocol] || 0) + t.amount;
    volumeByToken[t.token] = (volumeByToken[t.token] || 0) + t.amount;
  }

  const breakerStatus = await breakerService.getAllBreakerStatus();

  return {
    totalTransfers: all.length,
    completedTransfers: completed.length,
    failedTransfers: failed.length,
    pendingTransfers: all.length - completed.length - failed.length,
    totalVolume,
    volumeByProtocol,
    volumeByToken,
    successRate: all.length > 0 ? (completed.length / all.length).toFixed(2) : '0.00',
    circuitBreakers: breakerStatus.summary,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  initiateTransfer,
  updateConfirmations,
  failTransfer,
  getTransfer,
  listTransfers,
  getArchivedTransfer,
  listArchivedTransfers,
  cleanupArchive,
  getBridgeAnalytics,
  validateTransfer,
  validateTxHash,
  verifyTxHashAgainstIntent,
  PROTOCOLS,
  TRANSFER_STATUS,
  SECURITY,
  TX_HASH_RE,
  TOKEN_CONTRACTS,
  ERC20_TRANSFER_TOPIC,
  MAX_TRANSFERS_IN_MEMORY,
  ARCHIVE_RETENTION_MS,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
};
