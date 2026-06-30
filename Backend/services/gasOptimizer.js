/**
 * GAS OPTIMIZER SERVICE
 * Optimizes gas usage for blockchain transactions.
 *
 * Responsibilities:
 *  - Analyze transaction gas costs
 *  - Suggest gas optimizations
 *  - Calculate optimal gas prices
 *  - Provide gas usage analytics
 *  - Support batch transaction optimization
 */

// In-memory store for simulation (In production, backed by Mongoose + on-chain reads)
const analyses = new Map();
const batchOptimizations = new Map();

// Simulated EIP-1559 network gas data (in Gwei).
// In production these would be fetched from the RPC node or gas APIs.
const NETWORK_GAS = {
  baseFee: 20,        // current base fee (Gwei)
  priorityLow: 1,     // slow tip
  priorityMedium: 2,  // standard tip
  priorityHigh: 5,    // fast tip
};

// Standard gas units consumed by common operation types.
const GAS_UNITS = {
  transfer: 21_000,
  erc20Transfer: 65_000,
  swap: 150_000,
  addLiquidity: 200_000,
  removeLiquidity: 180_000,
  bridge: 250_000,
  approve: 46_000,
  multicall: 5_000, // per-call overhead when bundled in a multicall
};

const ETH_PRICE_USD = 2500; // used to convert gas cost to USD
const GWEI_TO_ETH = 1e-9;

/**
 * Calculate the gas cost in ETH and USD for given gas units and price.
 * @param {number} gasUnits
 * @param {number} gasPriceGwei
 * @returns {{ eth: number, usd: number }}
 */
function calcCost(gasUnits, gasPriceGwei) {
  const eth = gasUnits * gasPriceGwei * GWEI_TO_ETH;
  return { eth, usd: eth * ETH_PRICE_USD };
}

/**
 * Get current optimal gas prices for slow / standard / fast inclusion.
 * @returns {Promise<object>}
 */
async function getOptimalGasPrices() {
  const { baseFee, priorityLow, priorityMedium, priorityHigh } = NETWORK_GAS;

  return {
    slow: {
      maxFeePerGas: baseFee + priorityLow,
      maxPriorityFeePerGas: priorityLow,
      estimatedWaitSeconds: 120,
    },
    standard: {
      maxFeePerGas: baseFee + priorityMedium,
      maxPriorityFeePerGas: priorityMedium,
      estimatedWaitSeconds: 30,
    },
    fast: {
      maxFeePerGas: baseFee + priorityHigh,
      maxPriorityFeePerGas: priorityHigh,
      estimatedWaitSeconds: 15,
    },
    baseFee,
    unit: 'Gwei',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Analyze a transaction's gas cost and return optimization suggestions.
 * @param {object} params
 * @param {string} params.operationType - key from GAS_UNITS
 * @param {number} [params.currentGasPrice] - Gwei, if provided shows saving vs current
 * @param {string} [params.txData] - raw calldata hex (optional; used to estimate calldata cost)
 * @returns {Promise<object>}
 */
async function analyzeTransaction({ operationType, currentGasPrice, txData }) {
  const gasUnits = GAS_UNITS[operationType];
  if (!gasUnits) {
    throw new Error(`Unknown operation type: ${operationType}. Known: ${Object.keys(GAS_UNITS).join(', ')}`);
  }

  const prices = await getOptimalGasPrices();
  const standardCost = calcCost(gasUnits, prices.standard.maxFeePerGas);

  const suggestions = [];

  // Calldata analysis: non-zero bytes cost 16 gas, zero bytes cost 4 gas
  let calldataGas = 0;
  if (txData && txData.startsWith('0x')) {
    const bytes = txData.slice(2).match(/.{1,2}/g) || [];
    for (const b of bytes) {
      calldataGas += b === '00' ? 4 : 16;
    }
    if (calldataGas > 5000) {
      suggestions.push({
        type: 'CALLDATA_COMPRESSION',
        description: 'Consider compressing calldata — large calldata detected.',
        potentialSavingGas: Math.floor(calldataGas * 0.3),
      });
    }
  }

  // Batching suggestion
  if (['erc20Transfer', 'approve', 'swap'].includes(operationType)) {
    suggestions.push({
      type: 'BATCH_TRANSACTIONS',
      description: `Bundle multiple ${operationType}s into a multicall to amortize base tx cost (21,000 gas).`,
      potentialSavingGas: 21_000,
    });
  }

  // Off-peak timing
  suggestions.push({
    type: 'OFF_PEAK_TIMING',
    description: 'Submitting during low-activity periods (weekends, late UTC night) can lower base fee by 30–50%.',
    potentialSavingGas: Math.floor(gasUnits * 0.15),
  });

  // Gas price comparison
  let currentCost = null;
  let savingVsCurrent = null;
  if (currentGasPrice) {
    currentCost = calcCost(gasUnits, currentGasPrice);
    savingVsCurrent = {
      eth: currentCost.eth - standardCost.eth,
      usd: currentCost.usd - standardCost.usd,
    };
  }

  const analysisId = 'gas_' + Math.random().toString(36).substr(2, 9);
  const result = {
    id: analysisId,
    operationType,
    gasUnits,
    calldataGas,
    totalGasUnits: gasUnits + calldataGas,
    costAtSlow: calcCost(gasUnits + calldataGas, prices.slow.maxFeePerGas),
    costAtStandard: calcCost(gasUnits + calldataGas, prices.standard.maxFeePerGas),
    costAtFast: calcCost(gasUnits + calldataGas, prices.fast.maxFeePerGas),
    currentCost,
    savingVsCurrent,
    suggestions,
    optimalGasPrices: prices,
    analyzedAt: new Date().toISOString(),
  };

  analyses.set(analysisId, result);
  return result;
}

/**
 * Optimize a batch of transactions by bundling them into a multicall,
 * estimating the gas saving vs executing them individually.
 * @param {object[]} transactions - Array of { operationType, count? }
 * @returns {Promise<object>}
 */
async function optimizeBatch(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error('transactions must be a non-empty array');
  }

  const prices = await getOptimalGasPrices();
  let individualGas = 0;

  const breakdown = [];
  for (const tx of transactions) {
    const units = GAS_UNITS[tx.operationType];
    if (!units) throw new Error(`Unknown operation type: ${tx.operationType}`);
    const count = Number(tx.count) || 1;
    const txGas = units * count;
    // Each individual tx also pays the 21,000 base fee
    individualGas += txGas + 21_000 * count;
    breakdown.push({ operationType: tx.operationType, count, gasUnits: txGas });
  }

  // Multicall: pay base 21,000 once + per-operation overhead + multicall overhead per op
  const totalOps = transactions.reduce((s, t) => s + (Number(t.count) || 1), 0);
  const batchedGas =
    21_000 +
    breakdown.reduce((s, b) => s + b.gasUnits, 0) +
    GAS_UNITS.multicall * totalOps;

  const savedGas = individualGas - batchedGas;
  const savedCost = calcCost(savedGas, prices.standard.maxFeePerGas);

  const batchId = 'batch_' + Math.random().toString(36).substr(2, 9);
  const result = {
    id: batchId,
    transactions: breakdown,
    totalOps,
    individualGasTotal: individualGas,
    batchedGasTotal: batchedGas,
    savedGas,
    savedCostAtStandard: savedCost,
    savingPercent: ((savedGas / individualGas) * 100).toFixed(2),
    recommendation: savedGas > 0 ? 'Batch execution is recommended' : 'Batching provides no saving for this set',
    optimizedAt: new Date().toISOString(),
  };

  batchOptimizations.set(batchId, result);
  return result;
}

/**
 * Get gas usage analytics across all recorded analyses.
 * @returns {Promise<object>}
 */
async function getGasAnalytics() {
  const allAnalyses = Array.from(analyses.values());
  const allBatches = Array.from(batchOptimizations.values());

  const byType = {};
  for (const a of allAnalyses) {
    if (!byType[a.operationType]) byType[a.operationType] = { count: 0, totalGasUnits: 0 };
    byType[a.operationType].count++;
    byType[a.operationType].totalGasUnits += a.totalGasUnits;
  }

  const totalBatchSavingsUSD = allBatches.reduce((s, b) => s + b.savedCostAtStandard.usd, 0);

  return {
    totalAnalyses: allAnalyses.length,
    totalBatchOptimizations: allBatches.length,
    analysesByType: byType,
    totalBatchSavingsUSD,
    currentNetworkGas: NETWORK_GAS,
    ethPriceUSD: ETH_PRICE_USD,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getOptimalGasPrices,
  analyzeTransaction,
  optimizeBatch,
  getGasAnalytics,
  GAS_UNITS,
};
