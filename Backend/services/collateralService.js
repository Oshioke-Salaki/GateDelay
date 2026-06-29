const Big = require('big.js');
const Collateral = require('../models/Collateral');

/**
 * COLLATERAL SERVICE
 * Manages market collateral deposits, ratios, liquidation, and real-time tracking
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const COLLATERAL_STATUSES = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  LIQUIDATING: 'Liquidating',
  LIQUIDATED: 'Liquidated',
  WITHDRAWN: 'Withdrawn',
};

const DEFAULT_REQUIRED_RATIO = '150'; // 150% minimum
const DEFAULT_LIQUIDATION_THRESHOLD = '120'; // 120% liquidation trigger
const MAX_PRICE_HISTORY = 1000; // Keep last 1000 price snapshots

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate Big.js number format
 * @param {string|number} value
 * @returns {Big}
 * @throws {Error} If invalid
 */
function validateBigNumber(value) {
  try {
    return new Big(value);
  } catch (error) {
    throw new Error(`Invalid number format: ${value}`);
  }
}

/**
 * Calculate collateralization ratio
 * @param {string} collateralValue - Current collateral USD value
 * @param {string} borrowAmount - Amount borrowed
 * @returns {string} Ratio as percentage string (e.g., "150")
 */
function calculateCollateralizationRatio(collateralValue, borrowAmount) {
  const value = validateBigNumber(collateralValue);
  const borrowed = validateBigNumber(borrowAmount);

  if (borrowed.eq(0)) {
    return '0';
  }

  const ratio = value.div(borrowed).times(100);
  return ratio.toFixed(2);
}

/**
 * Check if collateral meets minimum requirements
 * @param {string} ratio - Collateralization ratio
 * @param {string} requiredRatio - Minimum required ratio
 * @returns {boolean}
 */
function meetsMinimumRatio(ratio, requiredRatio) {
  return new Big(ratio).gte(new Big(requiredRatio));
}

/**
 * Check if liquidation should be triggered
 * @param {string} ratio - Collateralization ratio
 * @param {string} liquidationThreshold - Liquidation threshold
 * @returns {boolean}
 */
function shouldTriggerLiquidation(ratio, liquidationThreshold) {
  return new Big(ratio).lte(new Big(liquidationThreshold));
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * A. DEPOSIT COLLATERAL
 * Creates a new collateral deposit for a user
 *
 * @param {object} params
 * @param {string} params.userId - User ID
 * @param {string} params.assetSymbol - Asset symbol (e.g., "ETH", "BTC")
 * @param {string} params.depositAmount - Amount to deposit
 * @param {string} params.currentPrice - Current asset price in USD
 * @param {string} [params.requiredRatio] - Custom minimum ratio (defaults to 150%)
 * @param {string} [params.liquidationThreshold] - Custom liquidation threshold (defaults to 120%)
 * @returns {Promise<object>} Created collateral record
 * @throws {Error} If validation fails
 */
async function depositCollateral(params) {
  try {
    const {
      userId,
      assetSymbol,
      depositAmount,
      currentPrice,
      requiredRatio = DEFAULT_REQUIRED_RATIO,
      liquidationThreshold = DEFAULT_LIQUIDATION_THRESHOLD,
    } = params;

    // Validate inputs
    if (!userId || typeof userId !== 'string')
      throw new Error('Invalid userId');
    if (!assetSymbol || typeof assetSymbol !== 'string')
      throw new Error('Invalid assetSymbol');

    const amount = validateBigNumber(depositAmount);
    const price = validateBigNumber(currentPrice);

    if (amount.lte(0)) throw new Error('Deposit amount must be positive');
    if (price.lte(0)) throw new Error('Asset price must be positive');

    validateBigNumber(requiredRatio);
    validateBigNumber(liquidationThreshold);

    // Calculate deposit value
    const depositValue = amount.times(price).toFixed(2);

    // Create collateral record
    const collateral = new Collateral({
      userId,
      assetSymbol,
      depositAmount: amount.toFixed(8),
      depositValue,
      currentAmount: amount.toFixed(8),
      currentValue: depositValue,
      requiredRatio,
      liquidationThreshold,
      priceHistory: [
        {
          price: price.toFixed(8),
          value: depositValue,
          timestamp: new Date(),
        },
      ],
      status: COLLATERAL_STATUSES.ACTIVE,
      collateralizationRatio: '0', // Will be set when borrowed amount is linked
    });

    await collateral.save();

    return {
      success: true,
      data: collateral,
      message: 'Collateral deposited successfully',
    };
  } catch (error) {
    throw new Error(`Failed to deposit collateral: ${error.message}`);
  }
}

/**
 * B. UPDATE COLLATERAL VALUE
 * Updates collateral current value based on new market price
 * Tracks price history and checks liquidation trigger
 *
 * @param {string} collateralId - Collateral record ID
 * @param {string} newPrice - New asset price in USD
 * @param {string} [borrowAmount] - Current borrowed amount (for ratio calc)
 * @returns {Promise<object>} Updated collateral with new ratio
 * @throws {Error} If not found or validation fails
 */
async function updateCollateralValue(collateralId, newPrice, borrowAmount) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    const price = validateBigNumber(newPrice);
    if (price.lte(0)) throw new Error('Price must be positive');

    const currentAmount = validateBigNumber(collateral.currentAmount);
    const newValue = currentAmount.times(price).toFixed(2);

    // Update current value
    collateral.currentValue = newValue;

    // Add to price history (keep last MAX_PRICE_HISTORY entries)
    collateral.priceHistory.push({
      price: price.toFixed(8),
      value: newValue,
      timestamp: new Date(),
    });

    if (collateral.priceHistory.length > MAX_PRICE_HISTORY) {
      collateral.priceHistory.shift();
    }

    // Calculate new ratio if borrowed amount provided
    if (borrowAmount) {
      const newRatio = calculateCollateralizationRatio(newValue, borrowAmount);
      collateral.collateralizationRatio = newRatio;

      // Check liquidation trigger
      if (shouldTriggerLiquidation(newRatio, collateral.liquidationThreshold)) {
        if (!collateral.isLiquidationTriggered) {
          collateral.isLiquidationTriggered = true;
          collateral.liquidationTimestamp = new Date();
          collateral.liquidationValue = newValue;
          collateral.status = COLLATERAL_STATUSES.LIQUIDATING;
        }
      } else {
        // Reset liquidation if ratio recovers
        if (
          collateral.isLiquidationTriggered &&
          collateral.status === COLLATERAL_STATUSES.LIQUIDATING
        ) {
          collateral.isLiquidationTriggered = false;
          collateral.status = COLLATERAL_STATUSES.ACTIVE;
        }
      }
    }

    collateral.updatedAt = new Date();
    await collateral.save();

    return {
      success: true,
      data: collateral,
      message: 'Collateral value updated',
    };
  } catch (error) {
    throw new Error(`Failed to update collateral value: ${error.message}`);
  }
}

/**
 * C. CALCULATE COLLATERAL RATIO
 * Calculates and returns collateralization ratio for a collateral
 *
 * @param {string} collateralId - Collateral record ID
 * @param {string} borrowAmount - Amount borrowed against collateral
 * @returns {Promise<object>} Ratio details
 * @throws {Error} If not found
 */
async function calculateCollateralRatio(collateralId, borrowAmount) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    validateBigNumber(borrowAmount);
    const ratio = calculateCollateralizationRatio(
      collateral.currentValue,
      borrowAmount,
    );

    const meetsMinimum = meetsMinimumRatio(ratio, collateral.requiredRatio);
    const shouldLiquidate = shouldTriggerLiquidation(
      ratio,
      collateral.liquidationThreshold,
    );

    return {
      success: true,
      data: {
        collateralId,
        collateralValue: collateral.currentValue,
        borrowAmount,
        ratio,
        requiredRatio: collateral.requiredRatio,
        liquidationThreshold: collateral.liquidationThreshold,
        meetsMinimum,
        shouldLiquidate,
        assetSymbol: collateral.assetSymbol,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate ratio: ${error.message}`);
  }
}

/**
 * D. TRIGGER LIQUIDATION
 * Manually triggers liquidation for a collateral record
 * Sets status and records liquidation details
 *
 * @param {string} collateralId - Collateral record ID
 * @param {string} [reason] - Liquidation reason
 * @returns {Promise<object>} Liquidated collateral
 * @throws {Error} If not found or invalid state
 */
async function triggerLiquidation(
  collateralId,
  reason = 'Ratio threshold breached',
) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    if (collateral.status === COLLATERAL_STATUSES.LIQUIDATED) {
      throw new Error('Collateral already liquidated');
    }

    collateral.isLiquidationTriggered = true;
    collateral.liquidationTimestamp = new Date();
    collateral.liquidationValue = collateral.currentValue;
    collateral.status = COLLATERAL_STATUSES.LIQUIDATING;
    collateral.notes = reason;
    collateral.updatedAt = new Date();

    await collateral.save();

    return {
      success: true,
      data: collateral,
      message: 'Liquidation triggered successfully',
    };
  } catch (error) {
    throw new Error(`Failed to trigger liquidation: ${error.message}`);
  }
}

/**
 * E. COMPLETE LIQUIDATION
 * Marks liquidation as complete
 *
 * @param {string} collateralId - Collateral record ID
 * @param {string} liquidationProceeds - Amount received from liquidation
 * @returns {Promise<object>} Liquidated collateral
 * @throws {Error} If not found or invalid state
 */
async function completeLiquidation(collateralId, liquidationProceeds) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    if (collateral.status !== COLLATERAL_STATUSES.LIQUIDATING) {
      throw new Error('Collateral is not in liquidating state');
    }

    validateBigNumber(liquidationProceeds);

    collateral.status = COLLATERAL_STATUSES.LIQUIDATED;
    collateral.currentAmount = '0';
    collateral.currentValue = liquidationProceeds;
    collateral.updatedAt = new Date();

    await collateral.save();

    return {
      success: true,
      data: collateral,
      message: 'Liquidation completed successfully',
    };
  } catch (error) {
    throw new Error(`Failed to complete liquidation: ${error.message}`);
  }
}

/**
 * F. WITHDRAW COLLATERAL
 * Withdraws collateral when no longer needed
 *
 * @param {string} collateralId - Collateral record ID
 * @param {string} withdrawAmount - Amount to withdraw
 * @returns {Promise<object>} Updated collateral
 * @throws {Error} If insufficient amount or invalid state
 */
async function withdrawCollateral(collateralId, withdrawAmount) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    if (
      collateral.status === COLLATERAL_STATUSES.LIQUIDATING ||
      collateral.status === COLLATERAL_STATUSES.LIQUIDATED
    ) {
      throw new Error('Cannot withdraw liquidating or liquidated collateral');
    }

    const current = validateBigNumber(collateral.currentAmount);
    const withdraw = validateBigNumber(withdrawAmount);

    if (withdraw.gt(current)) {
      throw new Error('Withdrawal amount exceeds available collateral');
    }

    const remaining = current.minus(withdraw);
    const currentPrice = validateBigNumber(
      collateral.priceHistory[collateral.priceHistory.length - 1]?.price || '0',
    );
    const newValue = remaining.times(currentPrice).toFixed(2);

    collateral.currentAmount = remaining.toFixed(8);
    collateral.currentValue = newValue;

    // If fully withdrawn, mark as withdrawn
    if (remaining.eq(0)) {
      collateral.status = COLLATERAL_STATUSES.WITHDRAWN;
    }

    collateral.updatedAt = new Date();
    await collateral.save();

    return {
      success: true,
      data: collateral,
      message: 'Collateral withdrawn successfully',
    };
  } catch (error) {
    throw new Error(`Failed to withdraw collateral: ${error.message}`);
  }
}

/**
 * G. GET COLLATERAL BY ID
 * Retrieves single collateral record
 *
 * @param {string} collateralId - Collateral record ID
 * @returns {Promise<object>} Collateral record
 * @throws {Error} If not found
 */
async function getCollateral(collateralId) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    return {
      success: true,
      data: collateral,
    };
  } catch (error) {
    throw new Error(`Failed to fetch collateral: ${error.message}`);
  }
}

/**
 * H. GET USER COLLATERALS
 * Retrieves all collaterals for a user with optional filters
 *
 * @param {string} userId - User ID
 * @param {object} [options] - Filter options
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.assetSymbol] - Filter by asset
 * @param {number} [options.page] - Page number (default 1)
 * @param {number} [options.limit] - Items per page (default 20)
 * @returns {Promise<object>} Paginated collaterals
 * @throws {Error} If validation fails
 */
async function getUserCollaterals(userId, options = {}) {
  try {
    if (!userId || typeof userId !== 'string')
      throw new Error('Invalid userId');

    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { userId };
    if (options.status) filter.status = options.status;
    if (options.assetSymbol) filter.assetSymbol = options.assetSymbol;

    // Execute queries in parallel
    const [collaterals, total] = await Promise.all([
      Collateral.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collateral.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        collaterals,
        total,
        page,
        limit,
        totalPages,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch user collaterals: ${error.message}`);
  }
}

/**
 * I. GET LIQUIDATION CANDIDATES
 * Retrieves all collaterals that should trigger liquidation
 *
 * @param {object} [options] - Filter options
 * @param {number} [options.page] - Page number (default 1)
 * @param {number} [options.limit] - Items per page (default 50)
 * @returns {Promise<object>} Liquidation candidate collaterals
 */
async function getLiquidationCandidates(options = {}) {
  try {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {
      isLiquidationTriggered: true,
      status: {
        $in: [COLLATERAL_STATUSES.ACTIVE, COLLATERAL_STATUSES.LIQUIDATING],
      },
    };

    const [candidates, total] = await Promise.all([
      Collateral.find(filter)
        .sort({ liquidationTimestamp: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collateral.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        candidates,
        total,
        page,
        limit,
        totalPages,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch liquidation candidates: ${error.message}`);
  }
}

/**
 * J. GET COLLATERAL ANALYTICS
 * Returns comprehensive collateral analytics
 *
 * @returns {Promise<object>} Analytics data
 */
async function getCollateralAnalytics() {
  try {
    // Total collateral value
    const collaterals = await Collateral.find({
      status: COLLATERAL_STATUSES.ACTIVE,
    });

    let totalValue = new Big(0);
    let totalAmount = new Big(0);
    const assetBreakdown = {};

    collaterals.forEach((c) => {
      totalValue = totalValue.plus(new Big(c.currentValue));
      totalAmount = totalAmount.plus(new Big(c.currentAmount));

      if (!assetBreakdown[c.assetSymbol]) {
        assetBreakdown[c.assetSymbol] = {
          count: 0,
          totalAmount: new Big(0),
          totalValue: new Big(0),
        };
      }
      assetBreakdown[c.assetSymbol].count += 1;
      assetBreakdown[c.assetSymbol].totalAmount = assetBreakdown[
        c.assetSymbol
      ].totalAmount.plus(new Big(c.currentAmount));
      assetBreakdown[c.assetSymbol].totalValue = assetBreakdown[
        c.assetSymbol
      ].totalValue.plus(new Big(c.currentValue));
    });

    // Liquidation stats
    const liquidationStats = await Collateral.aggregate([
      {
        $match: { isLiquidationTriggered: true },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Status breakdown
    const statusStats = await Collateral.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Format asset breakdown
    const formattedAssets = {};
    Object.keys(assetBreakdown).forEach((asset) => {
      formattedAssets[asset] = {
        count: assetBreakdown[asset].count,
        totalAmount: assetBreakdown[asset].totalAmount.toFixed(8),
        totalValue: assetBreakdown[asset].totalValue.toFixed(2),
      };
    });

    return {
      success: true,
      data: {
        summary: {
          totalActiveCollaterals: collaterals.length,
          totalValue: totalValue.toFixed(2),
          totalAmount: totalAmount.toFixed(8),
        },
        assetBreakdown: formattedAssets,
        liquidationStatus: liquidationStats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        statusBreakdown: statusStats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to generate analytics: ${error.message}`);
  }
}

/**
 * K. GET PRICE HISTORY
 * Retrieves price history for a collateral
 *
 * @param {string} collateralId - Collateral record ID
 * @param {number} [limit] - Max records to return (default 100)
 * @returns {Promise<object>} Price history
 * @throws {Error} If not found
 */
async function getPriceHistory(collateralId, limit = 100) {
  try {
    const collateral = await Collateral.findById(collateralId);
    if (!collateral) throw new Error('Collateral record not found');

    const history = collateral.priceHistory.slice(-limit);

    return {
      success: true,
      data: {
        collateralId,
        assetSymbol: collateral.assetSymbol,
        priceHistory: history,
        count: history.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch price history: ${error.message}`);
  }
}

module.exports = {
  depositCollateral,
  updateCollateralValue,
  calculateCollateralRatio,
  triggerLiquidation,
  completeLiquidation,
  withdrawCollateral,
  getCollateral,
  getUserCollaterals,
  getLiquidationCandidates,
  getCollateralAnalytics,
  getPriceHistory,
  COLLATERAL_STATUSES,
  DEFAULT_REQUIRED_RATIO,
  DEFAULT_LIQUIDATION_THRESHOLD,
};
