const Big = require('big.js');

/**
 * MARGIN UTILITIES
 * Core margin calculation helpers with Big.js precision
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const MARGIN_TYPES = {
  ISOLATED: 'Isolated',
  CROSS: 'Cross',
};

const DEFAULT_MARGIN_CONFIG = {
  INITIAL_MARGIN_RATIO: '10', // 10% initial margin
  MAINTENANCE_MARGIN_RATIO: '5', // 5% maintenance margin
  LIQUIDATION_MARGIN_RATIO: '4', // 4% liquidation margin
  MARGIN_CALL_THRESHOLD: '70', // 70% margin ratio
};

const LEVERAGE_LEVELS = {
  '1x': '1',
  '2x': '2',
  '5x': '5',
  '10x': '10',
  '20x': '20',
  '50x': '50',
  '100x': '100',
};

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Validate Big.js number
 */
function validateNumber(value, name = 'value') {
  try {
    return new Big(value);
  } catch (error) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

/**
 * Ensure positive number
 */
function ensurePositive(value, name = 'value') {
  const num = validateNumber(value, name);
  if (num.lte(0)) {
    throw new Error(`${name} must be positive, got: ${value}`);
  }
  return num;
}

// ─── Initial Margin Calculations ──────────────────────────────────────────────

/**
 * Calculate initial margin requirement
 * Formula: initialMargin = (notionalValue / leverage) / initialMarginRatio
 *
 * @param {string} notionalValue - Total position value
 * @param {string} leverage - Leverage multiplier (1x, 2x, 10x, etc.)
 * @param {string} [initialMarginRatio] - Initial margin % (default 10%)
 * @returns {string} Required initial margin
 */
function calculateInitialMargin(
  notionalValue,
  leverage,
  initialMarginRatio = DEFAULT_MARGIN_CONFIG.INITIAL_MARGIN_RATIO,
) {
  const value = ensurePositive(notionalValue, 'notionalValue');
  const lev = ensurePositive(leverage, 'leverage');
  const ratio = ensurePositive(initialMarginRatio, 'initialMarginRatio');

  // Initial Margin = Notional Value / Leverage * (Initial Margin Ratio / 100)
  const margin = value.div(lev).times(ratio).div(100);

  return margin.toFixed(2);
}

/**
 * Calculate required leverage from margin amount
 * Formula: leverage = notionalValue / (initialMargin * 100 / initialMarginRatio)
 *
 * @param {string} notionalValue - Total position value
 * @param {string} marginAmount - Margin provided by trader
 * @param {string} [initialMarginRatio] - Initial margin %
 * @returns {string} Maximum available leverage
 */
function calculateMaxLeverageFromMargin(
  notionalValue,
  marginAmount,
  initialMarginRatio = DEFAULT_MARGIN_CONFIG.INITIAL_MARGIN_RATIO,
) {
  const value = ensurePositive(notionalValue, 'notionalValue');
  const margin = ensurePositive(marginAmount, 'marginAmount');
  const ratio = ensurePositive(initialMarginRatio, 'initialMarginRatio');

  // Max Leverage = Notional Value / (Margin * 100 / Initial Margin Ratio)
  const leverage = value.div(margin.times(100).div(ratio));

  return leverage.toFixed(2);
}

// ─── Maintenance Margin Calculations ──────────────────────────────────────────

/**
 * Calculate maintenance margin requirement
 * Formula: maintenanceMargin = notionalValue * (maintenanceMarginRatio / 100)
 *
 * @param {string} notionalValue - Position notional value
 * @param {string} [maintenanceMarginRatio] - Maintenance margin % (default 5%)
 * @returns {string} Required maintenance margin
 */
function calculateMaintenanceMargin(
  notionalValue,
  maintenanceMarginRatio = DEFAULT_MARGIN_CONFIG.MAINTENANCE_MARGIN_RATIO,
) {
  const value = ensurePositive(notionalValue, 'notionalValue');
  const ratio = ensurePositive(
    maintenanceMarginRatio,
    'maintenanceMarginRatio',
  );

  // Maintenance Margin = Notional Value * (Maintenance Margin Ratio / 100)
  const margin = value.times(ratio).div(100);

  return margin.toFixed(2);
}

// ─── Margin Ratio & Health ────────────────────────────────────────────────────

/**
 * Calculate margin ratio (health indicator)
 * Formula: marginRatio = (equity / maintenanceMargin) * 100
 *
 * @param {string} equity - Current account equity
 * @param {string} maintenanceMargin - Required maintenance margin
 * @returns {string} Margin ratio %
 */
function calculateMarginRatio(equity, maintenanceMargin) {
  const eq = validateNumber(equity, 'equity');
  const mm = ensurePositive(maintenanceMargin, 'maintenanceMargin');

  if (eq.lte(0)) {
    return '0';
  }

  // Margin Ratio = (Equity / Maintenance Margin) * 100
  const ratio = eq.div(mm).times(100);

  return ratio.toFixed(2);
}

/**
 * Calculate account health score (0-100)
 * 100 = healthy, 0 = liquidation
 *
 * @param {string} marginRatio - Margin ratio %
 * @returns {string} Health score 0-100
 */
function calculateHealthScore(marginRatio) {
  const ratio = validateNumber(marginRatio, 'marginRatio');
  const healthScore = ratio.times(100).div(200); // 200% ratio = 100 health

  // Cap between 0 and 100
  if (healthScore.gt(100)) return '100';
  if (healthScore.lt(0)) return '0';

  return healthScore.toFixed(2);
}

// ─── Available Margin Calculations ───────────────────────────────────────────

/**
 * Calculate available margin for new positions
 * Formula: availableMargin = equity - usedMargin
 *
 * @param {string} equity - Current equity
 * @param {string} usedMargin - Current used margin
 * @returns {string} Available margin
 */
function calculateAvailableMargin(equity, usedMargin) {
  const eq = validateNumber(equity, 'equity');
  const used = validateNumber(usedMargin, 'usedMargin');

  const available = eq.minus(used);

  return available.gte(0) ? available.toFixed(2) : '0';
}

/**
 * Calculate max position size with available margin
 * Formula: maxPosition = availableMargin * leverage / (initialMarginRatio / 100)
 *
 * @param {string} availableMargin - Available margin amount
 * @param {string} leverage - Desired leverage
 * @param {string} [initialMarginRatio] - Initial margin %
 * @returns {string} Max notional position value
 */
function calculateMaxPositionSize(
  availableMargin,
  leverage,
  initialMarginRatio = DEFAULT_MARGIN_CONFIG.INITIAL_MARGIN_RATIO,
) {
  const margin = ensurePositive(availableMargin, 'availableMargin');
  const lev = ensurePositive(leverage, 'leverage');
  const ratio = ensurePositive(initialMarginRatio, 'initialMarginRatio');

  // Max Position = Available Margin * Leverage / (Initial Margin Ratio / 100)
  const maxPos = margin.times(lev).times(100).div(ratio);

  return maxPos.toFixed(2);
}

// ─── Margin Call & Liquidation ───────────────────────────────────────────────

/**
 * Check if margin call should be triggered
 * Formula: marginRatio < marginCallThreshold
 *
 * @param {string} marginRatio - Current margin ratio %
 * @param {string} [threshold] - Margin call threshold % (default 70%)
 * @returns {boolean} Should trigger margin call
 */
function shouldTriggerMarginCall(
  marginRatio,
  threshold = DEFAULT_MARGIN_CONFIG.MARGIN_CALL_THRESHOLD,
) {
  const ratio = validateNumber(marginRatio, 'marginRatio');
  const thresh = validateNumber(threshold, 'threshold');

  return ratio.lt(thresh);
}

/**
 * Check if liquidation should be triggered
 * Formula: marginRatio < liquidationMarginRatio
 *
 * @param {string} marginRatio - Current margin ratio %
 * @param {string} [liquidationRatio] - Liquidation threshold (default 4%)
 * @returns {boolean} Should liquidate
 */
function shouldTriggerLiquidation(
  marginRatio,
  liquidationRatio = DEFAULT_MARGIN_CONFIG.LIQUIDATION_MARGIN_RATIO,
) {
  const ratio = validateNumber(marginRatio, 'marginRatio');
  const liqRatio = validateNumber(liquidationRatio, 'liquidationRatio');

  return ratio.lt(liqRatio);
}

/**
 * Calculate margin level status
 * Returns: Healthy | Warning | Danger | Critical
 *
 * @param {string} marginRatio - Current margin ratio %
 * @returns {string} Margin status
 */
function getMarginStatus(marginRatio) {
  const ratio = new Big(marginRatio);

  if (ratio.gte(200)) return 'Healthy';
  if (ratio.gte(70)) return 'Warning';
  if (ratio.gte(5)) return 'Danger';
  return 'Critical';
}

// ─── P&L & Margin Impact ──────────────────────────────────────────────────────

/**
 * Calculate P&L impact on margin
 * Formula: newEquity = currentEquity + pnl
 *
 * @param {string} currentEquity - Current equity
 * @param {string} pnl - Profit/Loss amount (positive or negative)
 * @returns {string} New equity
 */
function calculateEquityWithPnL(currentEquity, pnl) {
  const equity = validateNumber(currentEquity, 'currentEquity');
  const change = validateNumber(pnl, 'pnl');

  const newEquity = equity.plus(change);

  return newEquity.gte(0) ? newEquity.toFixed(2) : '0';
}

/**
 * Calculate liquidation price
 * At liquidation: equity = 0
 * priceChange = (maintenanceMargin - initialEquity) / positionSize
 *
 * @param {string} entryPrice - Position entry price
 * @param {string} positionSize - Position size in contracts
 * @param {string} initialEquity - Initial equity in position
 * @param {string} maintenanceMargin - Maintenance margin required
 * @param {string} [side] - 'Long' or 'Short'
 * @returns {string} Liquidation price
 */
function calculateLiquidationPrice(
  entryPrice,
  positionSize,
  initialEquity,
  maintenanceMargin,
  side = 'Long',
) {
  const entry = ensurePositive(entryPrice, 'entryPrice');
  const size = ensurePositive(positionSize, 'positionSize');
  const equity = validateNumber(initialEquity, 'initialEquity');
  const mm = ensurePositive(maintenanceMargin, 'maintenanceMargin');

  // Price change needed to hit liquidation
  const maxLoss = equity.minus(mm);
  const priceChange = maxLoss.div(size);

  // Liquidation price
  const liquidationPrice =
    side === 'Long' ? entry.minus(priceChange) : entry.plus(priceChange);

  return liquidationPrice.gte(0) ? liquidationPrice.toFixed(2) : '0';
}

// ─── Margin Configuration ─────────────────────────────────────────────────────

/**
 * Create custom margin configuration
 *
 * @param {object} config - Custom configuration
 * @returns {object} Merged configuration
 */
function createMarginConfig(config = {}) {
  return {
    ...DEFAULT_MARGIN_CONFIG,
    ...config,
  };
}

/**
 * Validate margin configuration
 *
 * @param {object} config - Configuration to validate
 * @throws {Error} If invalid
 */
function validateMarginConfig(config) {
  const required = [
    'INITIAL_MARGIN_RATIO',
    'MAINTENANCE_MARGIN_RATIO',
    'LIQUIDATION_MARGIN_RATIO',
  ];

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required config: ${key}`);
    }

    try {
      const val = new Big(config[key]);
      if (val.lte(0) || val.gt(100)) {
        throw new Error(`${key} must be between 0 and 100`);
      }
    } catch (e) {
      throw new Error(`Invalid ${key}: ${config[key]}`);
    }
  }

  // Validate hierarchy
  const initial = new Big(config.INITIAL_MARGIN_RATIO);
  const maintenance = new Big(config.MAINTENANCE_MARGIN_RATIO);
  const liquidation = new Big(config.LIQUIDATION_MARGIN_RATIO);

  if (!initial.gt(maintenance)) {
    throw new Error('Initial margin must be > maintenance margin');
  }
  if (!maintenance.gt(liquidation)) {
    throw new Error('Maintenance margin must be > liquidation margin');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  MARGIN_TYPES,
  DEFAULT_MARGIN_CONFIG,
  LEVERAGE_LEVELS,

  // Initial margin
  calculateInitialMargin,
  calculateMaxLeverageFromMargin,

  // Maintenance margin
  calculateMaintenanceMargin,

  // Margin ratio & health
  calculateMarginRatio,
  calculateHealthScore,

  // Available margin
  calculateAvailableMargin,
  calculateMaxPositionSize,

  // Margin calls & liquidation
  shouldTriggerMarginCall,
  shouldTriggerLiquidation,
  getMarginStatus,

  // P&L & liquidation price
  calculateEquityWithPnL,
  calculateLiquidationPrice,

  // Configuration
  createMarginConfig,
  validateMarginConfig,

  // Helpers
  validateNumber,
  ensurePositive,
};
