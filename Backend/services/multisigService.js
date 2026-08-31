const { ethers } = require('ethers');

/**
 * MULTISIG SERVICE
 * Handles management of multi-signature wallets, signature collection, and transaction processing.
 *
 * Threat model (security review — issue #713):
 *  - Wallet registry (MULTISIG_WALLETS) and the pending-transaction store are both in-memory
 *    mocks; nothing here is persisted or broadcast on-chain yet. `processTransaction` is a
 *    stand-in for a future on-chain execution step.
 *  - Authorization is signature-based: `collectSignature` recovers the signer address from
 *    `signature` over the transaction id via `ethers.verifyMessage` (EIP-191 personal_sign)
 *    and requires it to match the claimed `owner`, who must in turn be a configured owner of
 *    the target wallet. A caller can no longer claim to be an owner by name alone — they must
 *    hold that owner's private key.
 *  - HTTP propose/execute identity is enforced in `routes/multisig.js` (issue #702): the
 *    service still accepts a caller-supplied proposer/executor address so unit tests can
 *    exercise the domain rules, but the route rejects unsigned claims before they reach here.
 *  - Wallet lookup uses own-property checks so reserved keys never resolve as wallets.
 *  - `TREASURY.scheme: 'BLS'` is aspirational metadata only — verification here is ECDSA via
 *    ethers for both schemes. There is no BLS signature support in this module.
 *  - Rate limiting for the HTTP surface lives in `routes/multisig.js` (see `strictDDoSGuard`),
 *    not in this module.
 */

// In-memory store for pending transactions (In production, this would be in MongoDB)
const pendingTransactions = new Map();

// Mock owner keys — non-secret, deterministic test keys (never used on any real chain)
// used only so the mock registry's owner addresses correspond to keys the test suite
// can actually sign with, exercising real ECDSA recovery end to end.
const MOCK_OWNER_PRIVATE_KEYS = {
  OWNER_1: '0x' + '11'.repeat(32),
  OWNER_2: '0x' + '22'.repeat(32),
  OWNER_3: '0x' + '33'.repeat(32),
  ADMIN_1: '0x' + '44'.repeat(32),
  ADMIN_2: '0x' + '55'.repeat(32),
  ADMIN_3: '0x' + '66'.repeat(32),
  ADMIN_4: '0x' + '77'.repeat(32),
  ADMIN_5: '0x' + '88'.repeat(32)
};

const addressOf = (privateKey) => new ethers.Wallet(privateKey).address;

// Mock Multi-sig Wallets Configuration
const MULTISIG_WALLETS = {
  'MARKET_OPS': {
    address: '0x1234567890123456789012345678901234567890',
    owners: [
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_1),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_2),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.OWNER_3)
    ],
    threshold: 2,
    scheme: 'ECDSA'
  },
  'TREASURY': {
    address: '0x0987654321098765432109876543210987654321',
    owners: [
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_1),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_2),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_3),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_4),
      addressOf(MOCK_OWNER_PRIVATE_KEYS.ADMIN_5)
    ],
    threshold: 3,
    scheme: 'BLS'
  }
};

/**
 * Get multisig wallet details
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
 * Propose a new multi-sig transaction
 * @param {string} walletId
 * @param {object} txData
 * @param {string} proposer
 * @returns {string} transactionId
 */
async function proposeTransaction(walletId, txData, proposer) {
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

  const txId = ethers.id(JSON.stringify(txData) + Date.now());

  pendingTransactions.set(txId, {
    id: txId,
    walletId,
    data: txData,
    proposer: normalizedProposer,
    signatures: [],
    status: 'Pending',
    createdAt: new Date().toISOString()
  });

  return txId;
}

/**
 * Collect signature for a pending transaction. The signer's address is recovered from
 * `signature` (over `txId`, EIP-191 personal_sign) and must match `owner`; a caller cannot
 * satisfy this by supplying an arbitrary string as `signature`.
 * @param {string} txId
 * @param {string} owner
 * @param {string} signature
 */
async function collectSignature(txId, owner, signature) {
  const tx = pendingTransactions.get(txId);
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

  let recovered;
  try {
    recovered = ethers.verifyMessage(txId, signature);
  } catch {
    throw new Error('Invalid signature');
  }

  if (recovered !== normalizedOwner) {
    throw new Error('Signature does not match owner');
  }

  if (tx.signatures.find(s => s.owner === normalizedOwner)) {
    throw new Error('Owner has already signed this transaction');
  }

  tx.signatures.push({ owner: normalizedOwner, signature, timestamp: new Date().toISOString() });

  // Update status if threshold reached
  if (tx.signatures.length >= wallet.threshold) {
    tx.status = 'Ready';
  }

  return tx;
}

/**
 * Process/Execute a multi-sig transaction
 * @param {string} txId
 * @param {string} [executor] optional owner address; when provided must be a wallet owner
 */
async function processTransaction(txId, executor) {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error('Transaction not found');

  const wallet = getWallet(tx.walletId);

  if (executor !== undefined) {
    let normalizedExecutor;
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
    throw new Error(`Insufficient signatures. Required: ${wallet.threshold}, Current: ${tx.signatures.length}`);
  }

  console.log(`Executing multisig transaction ${txId} for wallet ${tx.walletId}...`);

  // Logic to broadcast to blockchain would go here
  tx.status = 'Executed';
  tx.executedAt = new Date().toISOString();
  tx.txHash = '0x' + Math.random().toString(16).slice(2, 66);

  return tx;
}

/**
 * Track status of a transaction
 * @param {string} txId
 */
function getTransactionStatus(txId) {
  const tx = pendingTransactions.get(txId);
  if (!tx) throw new Error('Transaction not found');
  return tx;
}

module.exports = {
  getWallet,
  isOwner,
  proposeTransaction,
  collectSignature,
  processTransaction,
  getTransactionStatus
};
