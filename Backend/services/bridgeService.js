const { ethers } = require('ethers');

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

// In-memory store for simulation (In production, these would be Mongoose models)
const transfers = new Map();

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
async function initiateTransfer(params) {
  validateTransfer(params);

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

  transfers.set(transferId, transfer);
  return transfer;
}

/**
 * Record source-chain confirmations for a transfer and advance its status.
 * Once the required number of confirmations is reached the transfer is marked
 * COMPLETED.
 * @param {string} transferId
 * @param {number} confirmations - Latest observed source-chain confirmations
 * @param {object} [tx] - Optional { sourceTxHash, destTxHash }
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

  transfer.confirmations = count;
  if (tx.sourceTxHash) transfer.sourceTxHash = tx.sourceTxHash;
  if (tx.destTxHash) transfer.destTxHash = tx.destTxHash;

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
 * List transfers, optionally filtered.
 * @param {object} [filter] - { status, protocol, sender }
 * @returns {Promise<object[]>}
 */
async function listTransfers(filter = {}) {
  let results = Array.from(transfers.values());
  if (filter.status) results = results.filter((t) => t.status === filter.status);
  if (filter.protocol) results = results.filter((t) => t.protocol === filter.protocol);
  if (filter.sender) results = results.filter((t) => t.sender === filter.sender);
  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

  return {
    totalTransfers: all.length,
    completedTransfers: completed.length,
    failedTransfers: failed.length,
    pendingTransfers: all.length - completed.length - failed.length,
    totalVolume,
    volumeByProtocol,
    volumeByToken,
    successRate: all.length > 0 ? (completed.length / all.length).toFixed(2) : '0.00',
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  initiateTransfer,
  updateConfirmations,
  failTransfer,
  getTransfer,
  listTransfers,
  getBridgeAnalytics,
  validateTransfer,
  PROTOCOLS,
  TRANSFER_STATUS,
  SECURITY,
};
