const { ethers } = require('ethers');

/**
 * SWAP SERVICE
 * Handles market-based token swapping via 1inch-style routing.
 *
 * Responsibilities:
 *  - Provide swap quote endpoints
 *  - Execute token swaps
 *  - Track swap transactions
 *  - Calculate swap fees and rates
 *  - Support multi-hop swaps
 */

// In-memory store for simulation (In production, these would be Mongoose models)
const swaps = new Map();

const SWAP_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

// Simulated liquidity pools used for quote calculation.
// In production these would be fetched from on-chain AMM reserves.
const POOLS = {
  'USDC/WETH': { reserveA: 5_000_000, reserveB: 2000, fee: 0.003 },
  'WETH/WBTC': { reserveA: 2000, reserveB: 100, fee: 0.003 },
  'USDC/USDT': { reserveA: 10_000_000, reserveB: 10_000_000, fee: 0.0005 },
  'WETH/USDT': { reserveA: 2000, reserveB: 5_000_000, fee: 0.003 },
  'WBTC/USDT': { reserveA: 100, reserveB: 4_000_000, fee: 0.003 },
};

const SUPPORTED_TOKENS = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI'];

const FEE_TIERS = {
  STABLE: 0.0005,  // stable pairs
  STANDARD: 0.003, // most pairs
  EXOTIC: 0.01,    // low-liquidity pairs
};

/**
 * Resolve a direct pool key, or null if no direct pool exists.
 * @param {string} tokenIn
 * @param {string} tokenOut
 * @returns {{ pool: object, reversed: boolean } | null}
 */
function resolvePool(tokenIn, tokenOut) {
  const key = `${tokenIn}/${tokenOut}`;
  const revKey = `${tokenOut}/${tokenIn}`;
  if (POOLS[key]) return { pool: POOLS[key], reversed: false, key };
  if (POOLS[revKey]) return { pool: POOLS[revKey], reversed: true, key: revKey };
  return null;
}

/**
 * Constant-product AMM output calculation (x * y = k).
 * @param {number} amountIn
 * @param {number} reserveIn
 * @param {number} reserveOut
 * @param {number} fee - e.g. 0.003 for 0.3%
 * @returns {number}
 */
function getAmountOut(amountIn, reserveIn, reserveOut, fee) {
  const amountInWithFee = amountIn * (1 - fee);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

/**
 * Build a single-hop or two-hop route between tokenIn and tokenOut.
 * Uses WETH as an intermediate hop when no direct pool exists.
 * @param {string} tokenIn
 * @param {string} tokenOut
 * @returns {{ path: string[], hops: number } | null}
 */
function buildRoute(tokenIn, tokenOut) {
  if (resolvePool(tokenIn, tokenOut)) {
    return { path: [tokenIn, tokenOut], hops: 1 };
  }
  // Try two-hop via WETH
  if (tokenIn !== 'WETH' && tokenOut !== 'WETH') {
    if (resolvePool(tokenIn, 'WETH') && resolvePool('WETH', tokenOut)) {
      return { path: [tokenIn, 'WETH', tokenOut], hops: 2 };
    }
  }
  // Try two-hop via USDC
  if (tokenIn !== 'USDC' && tokenOut !== 'USDC') {
    if (resolvePool(tokenIn, 'USDC') && resolvePool('USDC', tokenOut)) {
      return { path: [tokenIn, 'USDC', tokenOut], hops: 2 };
    }
  }
  return null;
}

/**
 * Simulate executing a hop and return the output amount.
 * @param {number} amountIn
 * @param {string} tokenIn
 * @param {string} tokenOut
 * @returns {{ amountOut: number, fee: number, priceImpact: number }}
 */
function simulateHop(amountIn, tokenIn, tokenOut) {
  const resolved = resolvePool(tokenIn, tokenOut);
  if (!resolved) throw new Error(`No pool for ${tokenIn}/${tokenOut}`);

  const { pool, reversed } = resolved;
  const [reserveIn, reserveOut] = reversed
    ? [pool.reserveB, pool.reserveA]
    : [pool.reserveA, pool.reserveB];

  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, pool.fee);
  const feeAmount = amountIn * pool.fee;
  const spotPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  const priceImpact = Math.abs((spotPrice - executionPrice) / spotPrice);

  return { amountOut, fee: feeAmount, priceImpact };
}

/**
 * Get a swap quote for a given route and amount.
 * @param {object} params
 * @param {string} params.tokenIn
 * @param {string} params.tokenOut
 * @param {number|string} params.amountIn
 * @param {number} [params.slippageTolerance] - e.g. 0.005 for 0.5%
 * @returns {Promise<object>}
 */
async function getQuote({ tokenIn, tokenOut, amountIn, slippageTolerance = 0.005 }) {
  if (!SUPPORTED_TOKENS.includes(tokenIn)) throw new Error(`Unsupported token: ${tokenIn}`);
  if (!SUPPORTED_TOKENS.includes(tokenOut)) throw new Error(`Unsupported token: ${tokenOut}`);
  if (tokenIn === tokenOut) throw new Error('tokenIn and tokenOut must differ');

  const amount = Number(amountIn);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Invalid amountIn: ${amountIn}`);

  const route = buildRoute(tokenIn, tokenOut);
  if (!route) throw new Error(`No route found for ${tokenIn} → ${tokenOut}`);

  let currentAmount = amount;
  let totalFee = 0;
  let maxPriceImpact = 0;

  for (let i = 0; i < route.path.length - 1; i++) {
    const hop = simulateHop(currentAmount, route.path[i], route.path[i + 1]);
    totalFee += hop.fee;
    maxPriceImpact = Math.max(maxPriceImpact, hop.priceImpact);
    currentAmount = hop.amountOut;
  }

  const amountOut = currentAmount;
  const minimumAmountOut = amountOut * (1 - slippageTolerance);
  const exchangeRate = amountOut / amount;

  return {
    tokenIn,
    tokenOut,
    amountIn: amount,
    amountOut,
    minimumAmountOut,
    exchangeRate,
    fee: totalFee,
    priceImpact: maxPriceImpact,
    route: route.path,
    hops: route.hops,
    slippageTolerance,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute a token swap.
 * @param {object} params
 * @param {string} params.tokenIn
 * @param {string} params.tokenOut
 * @param {number|string} params.amountIn
 * @param {number} [params.slippageTolerance]
 * @param {string} params.sender
 * @param {string} params.recipient
 * @returns {Promise<object>}
 */
async function executeSwap({ tokenIn, tokenOut, amountIn, slippageTolerance = 0.005, sender, recipient }) {
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }

  const quote = await getQuote({ tokenIn, tokenOut, amountIn, slippageTolerance });

  const swapId = 'swp_' + Math.random().toString(36).substr(2, 9);
  const txHash = '0x' + Math.random().toString(16).slice(2, 66);

  const swap = {
    id: swapId,
    tokenIn: quote.tokenIn,
    tokenOut: quote.tokenOut,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    exchangeRate: quote.exchangeRate,
    fee: quote.fee,
    priceImpact: quote.priceImpact,
    route: quote.route,
    hops: quote.hops,
    sender,
    recipient,
    txHash,
    status: SWAP_STATUS.COMPLETED,
    executedAt: new Date().toISOString(),
  };

  swaps.set(swapId, swap);
  return swap;
}

/**
 * Get a swap transaction by ID.
 * @param {string} swapId
 * @returns {Promise<object>}
 */
async function getSwap(swapId) {
  const swap = swaps.get(swapId);
  if (!swap) throw new Error('Swap not found');
  return swap;
}

/**
 * List swap transactions, optionally filtered.
 * @param {object} [filter] - { status, tokenIn, tokenOut, sender }
 * @returns {Promise<object[]>}
 */
async function listSwaps(filter = {}) {
  let results = Array.from(swaps.values());
  if (filter.status) results = results.filter((s) => s.status === filter.status);
  if (filter.tokenIn) results = results.filter((s) => s.tokenIn === filter.tokenIn);
  if (filter.tokenOut) results = results.filter((s) => s.tokenOut === filter.tokenOut);
  if (filter.sender) results = results.filter((s) => s.sender === filter.sender);
  return results.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
}

/**
 * Aggregate swap analytics.
 * @returns {Promise<object>}
 */
async function getSwapAnalytics() {
  const all = Array.from(swaps.values());
  const completed = all.filter((s) => s.status === SWAP_STATUS.COMPLETED);

  const volumeByPair = {};
  let totalVolume = 0;
  let totalFees = 0;

  for (const s of completed) {
    const pair = `${s.tokenIn}/${s.tokenOut}`;
    volumeByPair[pair] = (volumeByPair[pair] || 0) + s.amountIn;
    totalVolume += s.amountIn;
    totalFees += s.fee;
  }

  const avgPriceImpact = completed.length > 0
    ? completed.reduce((sum, s) => sum + s.priceImpact, 0) / completed.length
    : 0;

  return {
    totalSwaps: all.length,
    completedSwaps: completed.length,
    totalVolume,
    totalFees,
    volumeByPair,
    averagePriceImpact: avgPriceImpact.toFixed(4),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getQuote,
  executeSwap,
  getSwap,
  listSwaps,
  getSwapAnalytics,
  SWAP_STATUS,
  SUPPORTED_TOKENS,
  FEE_TIERS,
};
