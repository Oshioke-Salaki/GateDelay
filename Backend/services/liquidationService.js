const Big = require('big.js');
const Collateral = require('../models/Collateral');
const Position = require('../models/Position'); // Assumes Position model exists

/**
 * LIQUIDATION SERVICE
 * Monitors, executes, and tracks position liquidations
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const LIQUIDATION_STATUSES = {
  PENDING: 'Pending',
  EXECUTING: 'Executing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

const PENALTY_TIERS = {
  STANDARD: '5', // 5% standard penalty
  SEVERE: '10', // 10% for severe undercollateralization
  CRITICAL: '15', // 15% for critical ratio
};

const PENALTY_THRESHOLDS = {
  SEVERE: '110', // Ratio below 110% = severe
  CRITICAL: '105', // Ratio below 105% = critical
};

const DEFAULT_LIQUIDATION_BONUS = '5'; // 5% bonus to liquidator

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate Big.js number
 */
function validateBigNumber(value) {
  try {
    return new Big(value);
  } catch (error) {
    throw new Error(`Invalid number format: ${value}`);
  }
}

/**
 * Determine penalty tier based on ratio
 */
function getPenaltyTier(ratio) {
  const r = new Big(ratio);

  if (r.lte(new Big(PENALTY_THRESHOLDS.CRITICAL))) {
    return PENALTY_TIERS.CRITICAL;
  }
  if (r.lte(new Big(PENALTY_THRESHOLDS.SEVERE))) {
    return PENALTY_TIERS.SEVERE;
  }
  return PENALTY_TIERS.STANDARD;
}

/**
 * Calculate liquidation penalty
 */
function calculatePenalty(collateralValue, penaltyPercent) {
  const value = validateBigNumber(collateralValue);
  const penalty = validateBigNumber(penaltyPercent);

  return value.times(penalty).div(100).toFixed(2);
}

/**
 * Calculate liquidation bonus for executor
 */
function calculateBonus(
  collateralValue,
  bonusPercent = DEFAULT_LIQUIDATION_BONUS,
) {
  const value = validateBigNumber(collateralValue);
  const bonus = validateBigNumber(bonusPercent);

  return value.times(bonus).div(100).toFixed(2);
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * A. MONITOR POSITION
 * Check if position meets liquidation criteria
 *
 * @param {string} positionId - Position ID
 * @param {string} collateralId - Associated collateral ID
 * @returns {Promise<object>} Liquidation status
 */
async function monitorPosition(positionId, collateralId) {
  try {
    if (!positionId || !collateralId) {
      throw new Error('Invalid positionId or collateralId');
    }

    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral not found');

    const position = await Position.findById(positionId);
    if (!position) throw new Error('Position not found');

    const currentRatio = new Big(collateral.collateralizationRatio);
    const threshold = new Big(collateral.liquidationThreshold);
    const isUndercollateralized = currentRatio.lte(threshold);

    return {
      success: true,
      data: {
        positionId,
        collateralId,
        currentRatio: collateral.collateralizationRatio,
        requiredRatio: collateral.requiredRatio,
        liquidationThreshold: collateral.liquidationThreshold,
        isUndercollateralized,
        penaltyTier: getPenaltyTier(collateral.collateralizationRatio),
        collateralValue: collateral.currentValue,
        borrowAmount: position.borrowAmount,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to monitor position: ${error.message}`);
  }
}

/**
 * B. DETECT LIQUIDATION CONDITIONS
 * Scan all positions for liquidation eligibility
 *
 * @param {object} [options] - Filter options
 * @param {number} [options.page] - Page number
 * @param {number} [options.limit] - Items per page
 * @returns {Promise<object>} Undercollateralized positions
 */
async function detectLiquidationConditions(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit) || 50));
    const skip = (page - 1) * limit;

    // Find collaterals that should be liquidated
    const undercollateralized = await Collateral.find({
      isLiquidationTriggered: true,
      status: { $in: ['Active', 'Liquidating'] },
    })
      .sort({ liquidationTimestamp: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Collateral.countDocuments({
      isLiquidationTriggered: true,
      status: { $in: ['Active', 'Liquidating'] },
    });

    const conditions = undercollateralized.map((c) => ({
      collateralId: c._id,
      userId: c.userId,
      assetSymbol: c.assetSymbol,
      currentRatio: c.collateralizationRatio,
      liquidationThreshold: c.liquidationThreshold,
      penaltyTier: getPenaltyTier(c.collateralizationRatio),
      collateralValue: c.currentValue,
      detectTime: new Date(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        conditions,
        total,
        page,
        limit,
        totalPages,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to detect liquidation conditions: ${error.message}`,
    );
  }
}

/**
 * C. EXECUTE LIQUIDATION
 * Execute position liquidation with penalty calculation
 *
 * @param {object} params
 * @param {string} params.positionId - Position ID
 * @param {string} params.collateralId - Collateral ID
 * @param {string} params.liquidatorAddress - Who executes (for bonus)
 * @param {string} [params.executionPrice] - Price at execution
 * @returns {Promise<object>} Liquidation execution details
 */
async function executeLiquidation(params) {
  try {
    const { positionId, collateralId, liquidatorAddress, executionPrice } =
      params;

    if (!positionId || !collateralId || !liquidatorAddress) {
      throw new Error('Missing required fields');
    }

    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral not found');

    const position = await Position.findById(positionId);
    if (!position) throw new Error('Position not found');

    validateBigNumber(executionPrice || collateral.currentValue);

    // Calculate penalty based on current ratio
    const penaltyPercent = getPenaltyTier(collateral.collateralizationRatio);
    const collateralValue = new Big(collateral.currentValue);
    const penalty = calculatePenalty(collateral.currentValue, penaltyPercent);
    const bonus = calculateBonus(collateral.currentValue);

    // Amount to liquidator (collateral - penalty + bonus)
    const liquidatorPayout = collateralValue
      .minus(new Big(penalty))
      .plus(new Big(bonus))
      .toFixed(2);

    // Amount for protocol (penalty)
    const protocolFees = penalty;

    // Execute liquidation
    const liquidationRecord = {
      positionId,
      collateralId,
      userId: collateral.userId,
      assetSymbol: collateral.assetSymbol,
      collateralAmount: collateral.currentAmount,
      collateralValue: collateral.currentValue,
      borrowAmount: position.borrowAmount,
      collateralizationRatio: collateral.collateralizationRatio,
      executionPrice: executionPrice || collateral.currentValue,
      penaltyPercent,
      penaltyAmount: penalty,
      liquidatorBonus: bonus,
      liquidatorAddress,
      liquidatorPayout,
      protocolFees,
      status: LIQUIDATION_STATUSES.COMPLETED,
      executedAt: new Date(),
    };

    // Save to history (create Liquidation model if needed)
    const Liquidation = require('../models/Liquidation');
    const liquidationDoc = new Liquidation(liquidationRecord);
    await liquidationDoc.save();

    // Update collateral status
    collateral.status = 'Liquidated';
    collateral.currentAmount = '0';
    collateral.currentValue = liquidatorPayout;
    await collateral.save();

    // Update position status
    position.status = 'Liquidated';
    position.liquidationId = liquidationDoc._id;
    await position.save();

    return {
      success: true,
      data: {
        liquidationId: liquidationDoc._id,
        positionId,
        collateralId,
        collateralValue: collateral.currentValue,
        penaltyAmount: penalty,
        penaltyPercent,
        liquidatorBonus: bonus,
        liquidatorPayout,
        protocolFees,
        status: LIQUIDATION_STATUSES.COMPLETED,
        executedAt: liquidationRecord.executedAt,
      },
      message: 'Liquidation executed successfully',
    };
  } catch (error) {
    throw new Error(`Failed to execute liquidation: ${error.message}`);
  }
}

/**
 * D. CALCULATE LIQUIDATION PENALTY
 * Calculate penalty for liquidation
 *
 * @param {string} collateralValue - Total collateral value
 * @param {string} collateralizationRatio - Current ratio
 * @returns {Promise<object>} Penalty details
 */
async function calculateLiquidationPenalty(
  collateralValue,
  collateralizationRatio,
) {
  try {
    validateBigNumber(collateralValue);
    validateBigNumber(collateralizationRatio);

    const penaltyPercent = getPenaltyTier(collateralizationRatio);
    const penalty = calculatePenalty(collateralValue, penaltyPercent);
    const bonus = calculateBonus(collateralValue);

    return {
      success: true,
      data: {
        collateralValue,
        collateralizationRatio,
        penaltyTier: penaltyPercent,
        penaltyAmount: penalty,
        liquidatorBonus: bonus,
        userReceives: new Big(collateralValue)
          .minus(new Big(penalty))
          .toFixed(2),
        protocolReceives: penalty,
        liquidatorReceives: bonus,
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate penalty: ${error.message}`);
  }
}

/**
 * E. HANDLE COLLATERAL DISTRIBUTION
 * Distribute liquidated collateral to involved parties
 *
 * @param {object} params
 * @param {string} params.liquidationId - Liquidation record ID
 * @param {string} params.liquidatorAddress - Liquidator wallet
 * @param {string} params.protocolTreasuryAddress - Protocol wallet
 * @returns {Promise<object>} Distribution details
 */
async function handleCollateralDistribution(params) {
  try {
    const { liquidationId, liquidatorAddress, protocolTreasuryAddress } =
      params;

    if (!liquidationId || !liquidatorAddress || !protocolTreasuryAddress) {
      throw new Error('Missing required addresses');
    }

    const Liquidation = require('../models/Liquidation');
    const liquidation = await Liquidation.findById(liquidationId);
    if (!liquidation) throw new Error('Liquidation record not found');

    if (liquidation.status !== LIQUIDATION_STATUSES.COMPLETED) {
      throw new Error('Liquidation not in completed state');
    }

    // Record distribution
    const distribution = {
      liquidationId,
      distributions: [
        {
          recipient: 'liquidator',
          address: liquidatorAddress,
          amount: liquidation.liquidatorPayout,
          reason: 'Liquidation execution bonus',
        },
        {
          recipient: 'protocol',
          address: protocolTreasuryAddress,
          amount: liquidation.protocolFees,
          reason: 'Protocol fee',
        },
      ],
      totalDistributed: new Big(liquidation.liquidatorPayout)
        .plus(new Big(liquidation.protocolFees))
        .toFixed(2),
      distributedAt: new Date(),
    };

    // Update liquidation record
    liquidation.distribution = distribution;
    liquidation.distributionStatus = 'Processed';
    await liquidation.save();

    return {
      success: true,
      data: distribution,
      message: 'Collateral distribution processed',
    };
  } catch (error) {
    throw new Error(
      `Failed to handle collateral distribution: ${error.message}`,
    );
  }
}

/**
 * F. GET LIQUIDATION HISTORY
 * Retrieve liquidation history with filters
 *
 * @param {object} [options] - Filter options
 * @param {string} [options.userId] - Filter by user
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.page] - Page number
 * @param {number} [options.limit] - Items per page
 * @returns {Promise<object>} Liquidation records
 */
async function getLiquidationHistory(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (options.userId) filter.userId = options.userId;
    if (options.status) filter.status = options.status;

    const Liquidation = require('../models/Liquidation');
    const [liquidations, total] = await Promise.all([
      Liquidation.find(filter)
        .sort({ executedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Liquidation.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        liquidations,
        total,
        page,
        limit,
        totalPages,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch liquidation history: ${error.message}`);
  }
}

/**
 * G. GET LIQUIDATION METRICS
 * Analytics on liquidation activity
 *
 * @returns {Promise<object>} Liquidation metrics
 */
async function getLiquidationMetrics() {
  try {
    const Liquidation = require('../models/Liquidation');

    // Total liquidations
    const totalLiquidations = await Liquidation.countDocuments();

    // By status
    const statusBreakdown = await Liquidation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Penalty statistics
    const penaltyStats = await Liquidation.aggregate([
      {
        $group: {
          _id: '$penaltyPercent',
          count: { $sum: 1 },
          avgPenalty: { $avg: { $toDouble: '$penaltyAmount' } },
          totalPenalty: { $sum: { $toDouble: '$penaltyAmount' } },
        },
      },
    ]);

    // Total fees collected
    const feeStats = await Liquidation.aggregate([
      {
        $group: {
          _id: null,
          totalProtocolFees: { $sum: { $toDouble: '$protocolFees' } },
          totalBonus: { $sum: { $toDouble: '$liquidatorBonus' } },
        },
      },
    ]);

    // User statistics
    const userStats = await Liquidation.aggregate([
      {
        $group: {
          _id: '$userId',
          liquidationCount: { $sum: 1 },
          totalPenalty: { $sum: { $toDouble: '$penaltyAmount' } },
        },
      },
      { $sort: { liquidationCount: -1 } },
      { $limit: 10 },
    ]);

    // Asset breakdown
    const assetBreakdown = await Liquidation.aggregate([
      {
        $group: {
          _id: '$assetSymbol',
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$collateralValue' } },
        },
      },
    ]);

    return {
      success: true,
      data: {
        summary: {
          totalLiquidations,
          statusBreakdown: statusBreakdown.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
          }, {}),
        },
        penalties: {
          breakdown: penaltyStats.map((p) => ({
            tier: p._id,
            count: p.count,
            averagePenalty: p.avgPenalty.toFixed(2),
            totalPenalty: p.totalPenalty.toFixed(2),
          })),
        },
        fees: {
          totalProtocolFees: feeStats[0]?.totalProtocolFees.toFixed(2) || '0',
          totalBonus: feeStats[0]?.totalBonus.toFixed(2) || '0',
        },
        topUsers: userStats.map((u) => ({
          userId: u._id,
          liquidationCount: u.liquidationCount,
          totalPenalty: u.totalPenalty.toFixed(2),
        })),
        assetBreakdown: assetBreakdown.map((a) => ({
          asset: a._id,
          liquidationCount: a.count,
          totalValue: a.totalValue.toFixed(2),
        })),
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to generate liquidation metrics: ${error.message}`);
  }
}

/**
 * H. GET LIQUIDATION BY ID
 * Retrieve single liquidation record
 *
 * @param {string} liquidationId - Liquidation ID
 * @returns {Promise<object>} Liquidation record
 */
async function getLiquidation(liquidationId) {
  try {
    const Liquidation = require('../models/Liquidation');
    const liquidation = await Liquidation.findById(liquidationId);
    if (!liquidation) throw new Error('Liquidation record not found');

    return {
      success: true,
      data: liquidation,
    };
  } catch (error) {
    throw new Error(`Failed to fetch liquidation: ${error.message}`);
  }
}

module.exports = {
  monitorPosition,
  detectLiquidationConditions,
  executeLiquidation,
  calculateLiquidationPenalty,
  handleCollateralDistribution,
  getLiquidationHistory,
  getLiquidationMetrics,
  getLiquidation,
  LIQUIDATION_STATUSES,
  PENALTY_TIERS,
  PENALTY_THRESHOLDS,
};
