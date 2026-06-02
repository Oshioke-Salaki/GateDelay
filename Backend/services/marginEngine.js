const Big = require('big.js');
const marginUtils = require('../utils/marginUtils');

/**
 * MARGIN ENGINE SERVICE
 * Core margin calculation and management for leveraged trading
 */

// ─── Models ───────────────────────────────────────────────────────────────────

const MarginAccount = require('../models/MarginAccount'); // Assumes model exists
const MarginCall = require('../models/MarginCall'); // Assumes model exists

// ─── Constants ─────────────────────────────────────────────────────────────────

const MARGIN_STATUSES = {
  HEALTHY: 'Healthy',
  WARNING: 'Warning',
  DANGER: 'Danger',
  CRITICAL: 'Critical',
  LIQUIDATING: 'Liquidating',
};

const NOTIFICATION_TYPES = {
  MARGIN_CALL: 'MarginCall',
  MARGIN_WARNING: 'MarginWarning',
  LIQUIDATION_RISK: 'LiquidationRisk',
};

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * A. CREATE MARGIN ACCOUNT
 * Initialize margin account for user
 *
 * @param {object} params
 * @param {string} params.userId - User ID
 * @param {string} params.initialBalance - Starting balance
 * @param {string} [params.marginType] - 'Isolated' or 'Cross'
 * @param {object} [params.config] - Custom margin config
 * @returns {Promise<object>} Created margin account
 */
async function createMarginAccount(params) {
  try {
    const {
      userId,
      initialBalance,
      marginType = marginUtils.MARGIN_TYPES.CROSS,
      config,
    } = params;

    if (!userId) throw new Error('Invalid userId');
    marginUtils.ensurePositive(initialBalance, 'initialBalance');

    const marginConfig = config
      ? marginUtils.createMarginConfig(config)
      : marginUtils.DEFAULT_MARGIN_CONFIG;
    marginUtils.validateMarginConfig(marginConfig);

    const account = new MarginAccount({
      userId,
      marginType,
      balance: initialBalance,
      equity: initialBalance,
      usedMargin: '0',
      availableMargin: initialBalance,
      totalBorrows: '0',
      marginRatio: '0',
      healthScore: '100',
      marginStatus: MARGIN_STATUSES.HEALTHY,
      config: marginConfig,
      positions: [],
      marginCalls: [],
      createdAt: new Date(),
    });

    await account.save();

    return {
      success: true,
      data: account,
      message: 'Margin account created successfully',
    };
  } catch (error) {
    throw new Error(`Failed to create margin account: ${error.message}`);
  }
}

/**
 * B. CALCULATE MARGIN REQUIREMENTS
 * Get all margin requirements for account
 *
 * @param {string} accountId - Margin account ID
 * @returns {Promise<object>} Margin requirements
 */
async function calculateMarginRequirements(accountId) {
  try {
    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    const initialMargin = marginUtils.calculateInitialMargin(
      account.balance,
      '1',
      account.config.INITIAL_MARGIN_RATIO,
    );

    const maintenanceMargin = marginUtils.calculateMaintenanceMargin(
      account.balance,
      account.config.MAINTENANCE_MARGIN_RATIO,
    );

    const liquidationMargin = marginUtils.calculateMaintenanceMargin(
      account.balance,
      account.config.LIQUIDATION_MARGIN_RATIO,
    );

    const marginRatio = marginUtils.calculateMarginRatio(
      account.equity,
      maintenanceMargin,
    );
    const healthScore = marginUtils.calculateHealthScore(marginRatio);

    return {
      success: true,
      data: {
        accountId,
        balance: account.balance,
        equity: account.equity,
        usedMargin: account.usedMargin,
        availableMargin: account.availableMargin,
        initialMargin,
        maintenanceMargin,
        liquidationMargin,
        marginRatio,
        healthScore,
        marginStatus: marginUtils.getMarginStatus(marginRatio),
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to calculate margin requirements: ${error.message}`,
    );
  }
}

/**
 * C. OPEN POSITION
 * Open new leveraged position with margin
 *
 * @param {object} params
 * @param {string} params.accountId - Margin account ID
 * @param {string} params.symbol - Trading pair (ETH/USD, BTC/USD)
 * @param {string} params.side - 'Long' or 'Short'
 * @param {string} params.leverage - Leverage multiplier
 * @param {string} params.collateral - Margin provided
 * @param {string} params.entryPrice - Entry price
 * @returns {Promise<object>} Opened position details
 */
async function openPosition(params) {
  try {
    const { accountId, symbol, side, leverage, collateral, entryPrice } =
      params;

    if (!accountId || !symbol || !side || !leverage || !collateral) {
      throw new Error('Missing required position parameters');
    }

    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    marginUtils.ensurePositive(leverage, 'leverage');
    marginUtils.ensurePositive(collateral, 'collateral');
    marginUtils.ensurePositive(entryPrice, 'entryPrice');

    // Check available margin
    const availMargin = new Big(account.availableMargin);
    const required = new Big(collateral);

    if (availMargin.lt(required)) {
      throw new Error(
        `Insufficient margin. Required: ${required}, Available: ${availMargin}`,
      );
    }

    // Calculate position size
    const positionSize = new Big(collateral).times(leverage).div(entryPrice);

    // Calculate maintenance margin for position
    const maintenanceMargin = marginUtils.calculateMaintenanceMargin(
      positionSize.times(entryPrice).toFixed(2),
      account.config.MAINTENANCE_MARGIN_RATIO,
    );

    // Calculate liquidation price
    const liquidationPrice = marginUtils.calculateLiquidationPrice(
      entryPrice,
      positionSize.toFixed(2),
      collateral,
      maintenanceMargin,
      side,
    );

    // Update account
    const newUsedMargin = new Big(account.usedMargin)
      .plus(collateral)
      .toFixed(2);
    const newAvailableMargin = marginUtils.calculateAvailableMargin(
      account.equity,
      newUsedMargin,
    );

    account.usedMargin = newUsedMargin;
    account.availableMargin = newAvailableMargin;

    const marginRatio = marginUtils.calculateMarginRatio(
      account.equity,
      newUsedMargin,
    );
    account.marginRatio = marginRatio;
    account.healthScore = marginUtils
      .calculateHealthScore(marginRatio)
      .toFixed(2);
    account.marginStatus = marginUtils.getMarginStatus(marginRatio);

    // Add position
    const position = {
      symbol,
      side,
      leverage,
      collateral,
      entryPrice,
      positionSize: positionSize.toFixed(8),
      maintenanceMargin,
      liquidationPrice,
      pnl: '0',
      status: 'Open',
      openedAt: new Date(),
    };

    account.positions.push(position);
    await account.save();

    return {
      success: true,
      data: {
        position,
        accountStatus: {
          usedMargin: account.usedMargin,
          availableMargin: newAvailableMargin,
          marginRatio,
          healthScore: account.healthScore,
        },
      },
      message: 'Position opened successfully',
    };
  } catch (error) {
    throw new Error(`Failed to open position: ${error.message}`);
  }
}

/**
 * D. UPDATE POSITION & MARGIN
 * Update position P&L and recalculate margin
 *
 * @param {object} params
 * @param {string} params.accountId - Margin account ID
 * @param {string} params.positionIndex - Position index
 * @param {string} params.currentPrice - Current market price
 * @returns {Promise<object>} Updated position and margin status
 */
async function updatePositionAndMargin(params) {
  try {
    const { accountId, positionIndex, currentPrice } = params;

    if (!accountId || typeof positionIndex !== 'number' || !currentPrice) {
      throw new Error('Missing required parameters');
    }

    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    const position = account.positions[positionIndex];
    if (!position) throw new Error('Position not found');

    marginUtils.ensurePositive(currentPrice, 'currentPrice');

    // Calculate P&L
    const positionValue = new Big(position.positionSize).times(currentPrice);
    const entryValue = new Big(position.positionSize).times(
      position.entryPrice,
    );
    const pnl =
      position.side === 'Long'
        ? positionValue.minus(entryValue)
        : entryValue.minus(positionValue);

    position.pnl = pnl.toFixed(2);
    position.currentPrice = currentPrice;

    // Recalculate account equity
    const totalPnL = account.positions.reduce((sum, p) => {
      return new Big(sum).plus(new Big(p.pnl || 0));
    }, new Big(0));

    const newEquity = new Big(account.balance).plus(totalPnL).toFixed(2);
    account.equity = newEquity;

    // Recalculate margin ratio
    const marginRatio = marginUtils.calculateMarginRatio(
      account.equity,
      account.usedMargin,
    );
    account.marginRatio = marginRatio;
    account.healthScore = marginUtils
      .calculateHealthScore(marginRatio)
      .toFixed(2);
    account.marginStatus = marginUtils.getMarginStatus(marginRatio);

    // Check margin call
    const callNeeded = marginUtils.shouldTriggerMarginCall(
      marginRatio,
      account.config.MARGIN_CALL_THRESHOLD,
    );
    const liquidationNeeded = marginUtils.shouldTriggerLiquidation(
      marginRatio,
      account.config.LIQUIDATION_MARGIN_RATIO,
    );

    // Create margin call if needed
    if (callNeeded && !account.marginCallActive) {
      const marginCall = new MarginCall({
        accountId,
        marginRatio,
        healthScore: account.healthScore,
        type: liquidationNeeded
          ? NOTIFICATION_TYPES.LIQUIDATION_RISK
          : NOTIFICATION_TYPES.MARGIN_CALL,
        status: 'Active',
        createdAt: new Date(),
      });
      await marginCall.save();

      account.marginCallActive = true;
      account.marginCalls.push(marginCall._id);
    }

    await account.save();

    return {
      success: true,
      data: {
        position: {
          ...position.toObject(),
          currentPrice,
          pnl: position.pnl,
        },
        accountStatus: {
          equity: account.equity,
          marginRatio: account.marginRatio,
          healthScore: account.healthScore,
          marginStatus: account.marginStatus,
          marginCallActive: account.marginCallActive,
          liquidationRisk: liquidationNeeded,
        },
      },
      message: 'Position updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update position: ${error.message}`);
  }
}

/**
 * E. CHECK MARGIN CALL
 * Determine if margin call should be triggered
 *
 * @param {string} accountId - Margin account ID
 * @returns {Promise<object>} Margin call status
 */
async function checkMarginCall(accountId) {
  try {
    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    const requirements = await calculateMarginRequirements(accountId);
    const marginRatio = new Big(requirements.data.marginRatio);

    const shouldCall = marginUtils.shouldTriggerMarginCall(
      requirements.data.marginRatio,
      account.config.MARGIN_CALL_THRESHOLD,
    );

    const shouldLiquidate = marginUtils.shouldTriggerLiquidation(
      requirements.data.marginRatio,
      account.config.LIQUIDATION_MARGIN_RATIO,
    );

    return {
      success: true,
      data: {
        accountId,
        currentMarginRatio: requirements.data.marginRatio,
        marginCallThreshold: account.config.MARGIN_CALL_THRESHOLD,
        liquidationThreshold: account.config.LIQUIDATION_MARGIN_RATIO,
        shouldTriggerCall: shouldCall,
        shouldTriggerLiquidation: shouldLiquidate,
        marginStatus: requirements.data.marginStatus,
        severity: shouldLiquidate
          ? 'CRITICAL'
          : shouldCall
            ? 'WARNING'
            : 'SAFE',
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to check margin call: ${error.message}`);
  }
}

/**
 * F. SEND MARGIN NOTIFICATION
 * Send notification to user about margin status
 *
 * @param {object} params
 * @param {string} params.userId - User ID
 * @param {string} params.accountId - Margin account ID
 * @param {string} params.type - Notification type
 * @param {object} params.data - Notification data
 * @returns {Promise<object>} Notification record
 */
async function sendMarginNotification(params) {
  try {
    const { userId, accountId, type, data } = params;

    if (!userId || !accountId || !type) {
      throw new Error('Missing required notification parameters');
    }

    // In production, integrate with notification service
    const notification = {
      userId,
      accountId,
      type,
      data,
      sentAt: new Date(),
      channel: 'email', // Could be email, SMS, webhook, etc.
    };

    // Log for now
    const Notification = require('../models/Notification');
    const doc = new Notification(notification);
    await doc.save();

    return {
      success: true,
      data: notification,
      message: `${type} notification sent to user`,
    };
  } catch (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }
}

/**
 * G. GET MARGIN METRICS
 * Retrieve comprehensive margin utilization metrics
 *
 * @param {string} accountId - Margin account ID
 * @returns {Promise<object>} Margin metrics
 */
async function getMarginMetrics(accountId) {
  try {
    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    const totalPnL = account.positions.reduce((sum, p) => {
      return new Big(sum).plus(new Big(p.pnl || 0));
    }, new Big(0));

    const avgLeverage =
      account.positions.length > 0
        ? account.positions
            .reduce(
              (sum, p) => new Big(sum).plus(new Big(p.leverage)),
              new Big(0),
            )
            .div(account.positions.length)
            .toFixed(2)
        : '1';

    return {
      success: true,
      data: {
        accountId,
        balance: account.balance,
        equity: account.equity,
        totalPnL: totalPnL.toFixed(2),
        totalBorrows: account.totalBorrows,
        usedMargin: account.usedMargin,
        availableMargin: account.availableMargin,
        marginRatio: account.marginRatio,
        healthScore: account.healthScore,
        marginStatus: account.marginStatus,
        marginType: account.marginType,
        positions: {
          total: account.positions.length,
          active: account.positions.filter((p) => p.status === 'Open').length,
          closed: account.positions.filter((p) => p.status === 'Closed').length,
        },
        leverage: {
          average: avgLeverage,
          max:
            account.positions.length > 0
              ? Math.max(...account.positions.map((p) => parseInt(p.leverage)))
              : 0,
        },
        marginCalls: {
          active: account.marginCallActive,
          total: account.marginCalls.length,
        },
        config: account.config,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to get margin metrics: ${error.message}`);
  }
}

/**
 * H. GET ACCOUNT MARGIN
 * Get complete margin account details
 *
 * @param {string} accountId - Margin account ID
 * @returns {Promise<object>} Margin account
 */
async function getMarginAccount(accountId) {
  try {
    const account = await MarginAccount.findById(accountId);
    if (!account) throw new Error('Margin account not found');

    return {
      success: true,
      data: account,
    };
  } catch (error) {
    throw new Error(`Failed to fetch margin account: ${error.message}`);
  }
}

module.exports = {
  createMarginAccount,
  calculateMarginRequirements,
  openPosition,
  updatePositionAndMargin,
  checkMarginCall,
  sendMarginNotification,
  getMarginMetrics,
  getMarginAccount,
  MARGIN_STATUSES,
  NOTIFICATION_TYPES,
};
