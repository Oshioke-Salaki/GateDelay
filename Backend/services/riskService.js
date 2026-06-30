const Big = require('big.js');
const Collateral = require('../models/Collateral');
const MarginAccount = require('../models/MarginAccount');

/**
 * RISK SERVICE
 * Market risk assessment, scoring, and management
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const RISK_METRICS = {
  PORTFOLIO_CONCENTRATION: 'PortfolioConcentration',
  PRICE_VOLATILITY: 'PriceVolatility',
  LEVERAGE_RATIO: 'LeverageRatio',
  LIQUIDATION_PROXIMITY: 'LiquidationProximity',
  COLLATERAL_CORRELATION: 'CollateralCorrelation',
  COUNTERPARTY_RISK: 'CounterpartyRisk',
};

const DEFAULT_RISK_CONFIG = {
  PORTFOLIO_CONCENTRATION_THRESHOLD: '30', // 30% max single asset
  VOLATILITY_THRESHOLD: '20', // 20% volatility = medium risk
  LEVERAGE_THRESHOLD: '10', // 10x leverage = medium risk
  LIQUIDATION_PROXIMITY_THRESHOLD: '20', // 20% away from liquidation
  CORRELATION_THRESHOLD: '0.8', // 80% correlation = high risk
};

const RISK_SCORE_WEIGHTS = {
  CONCENTRATION: '0.20',
  VOLATILITY: '0.25',
  LEVERAGE: '0.20',
  LIQUIDATION: '0.20',
  CORRELATION: '0.15',
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

function validateNumber(value, name = 'value') {
  try {
    return new Big(value);
  } catch (error) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function ensurePositive(value, name = 'value') {
  const num = validateNumber(value, name);
  if (num.lte(0)) throw new Error(`${name} must be positive`);
  return num;
}

// ─── Risk Scoring Functions ──────────────────────────────────────────────────

/**
 * A. CALCULATE PORTFOLIO CONCENTRATION RISK
 * Measures single-asset exposure
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} Concentration risk metrics
 */
async function calculateConcentrationRisk(userId) {
  try {
    if (!userId) throw new Error('Invalid userId');

    const collaterals = await Collateral.find({ userId, status: 'Active' });
    if (collaterals.length === 0) {
      return { score: '0', level: RISK_LEVELS.LOW, details: {} };
    }

    const totalValue = collaterals.reduce((sum, c) => {
      return new Big(sum).plus(new Big(c.currentValue));
    }, new Big(0));

    const assetConcentration = {};
    collaterals.forEach((c) => {
      if (!assetConcentration[c.assetSymbol]) {
        assetConcentration[c.assetSymbol] = new Big(0);
      }
      assetConcentration[c.assetSymbol] = assetConcentration[
        c.assetSymbol
      ].plus(new Big(c.currentValue));
    });

    const maxConcentration = Object.values(assetConcentration).reduce(
      (max, val) => {
        const pct = val.div(totalValue).times(100);
        return pct.gt(max) ? pct : max;
      },
      new Big(0),
    );

    const threshold = new Big(
      DEFAULT_RISK_CONFIG.PORTFOLIO_CONCENTRATION_THRESHOLD,
    );
    let score = maxConcentration.div(threshold).times(100);
    if (score.gt(100)) score = new Big(100);

    return {
      success: true,
      data: {
        metric: RISK_METRICS.PORTFOLIO_CONCENTRATION,
        score: score.toFixed(2),
        level: getRiskLevel(score),
        maxConcentration: maxConcentration.toFixed(2),
        threshold: DEFAULT_RISK_CONFIG.PORTFOLIO_CONCENTRATION_THRESHOLD,
        assetBreakdown: Object.entries(assetConcentration).map(
          ([asset, value]) => ({
            asset,
            value: value.toFixed(2),
            percentage: value.div(totalValue).times(100).toFixed(2),
          }),
        ),
        totalValue: totalValue.toFixed(2),
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate concentration risk: ${error.message}`);
  }
}

/**
 * B. CALCULATE VOLATILITY RISK
 * Measures price volatility from history
 *
 * @param {string} assetSymbol - Asset symbol
 * @param {object} priceHistory - Price history array
 * @returns {object} Volatility metrics
 */
function calculateVolatilityRisk(assetSymbol, priceHistory) {
  try {
    if (!priceHistory || priceHistory.length < 2) {
      return { score: '0', level: RISK_LEVELS.LOW };
    }

    const prices = priceHistory.map((p) => new Big(p.price));

    // Calculate returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = prices[i].minus(prices[i - 1]).div(prices[i - 1]);
      returns.push(ret);
    }

    if (returns.length === 0) {
      return { score: '0', level: RISK_LEVELS.LOW };
    }

    // Calculate standard deviation (volatility)
    const avgReturn = returns
      .reduce((sum, r) => sum.plus(r), new Big(0))
      .div(returns.length);
    const variance = returns
      .reduce((sum, r) => {
        return sum.plus(r.minus(avgReturn).pow(2));
      }, new Big(0))
      .div(returns.length);
    const stdDev = variance.sqrt().times(100); // Annualize

    const threshold = new Big(DEFAULT_RISK_CONFIG.VOLATILITY_THRESHOLD);
    let score = stdDev.div(threshold).times(100);
    if (score.gt(100)) score = new Big(100);

    return {
      metric: RISK_METRICS.PRICE_VOLATILITY,
      score: score.toFixed(2),
      level: getRiskLevel(score),
      volatility: stdDev.toFixed(2),
      threshold: DEFAULT_RISK_CONFIG.VOLATILITY_THRESHOLD,
      averageReturn: avgReturn.times(100).toFixed(4),
    };
  } catch (error) {
    return { score: '50', level: RISK_LEVELS.MEDIUM, error: error.message };
  }
}

/**
 * C. CALCULATE LEVERAGE RISK
 * Measures leverage exposure
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} Leverage risk metrics
 */
async function calculateLeverageRisk(userId) {
  try {
    const account = await MarginAccount.findOne({ userId });
    if (!account || !account.positions || account.positions.length === 0) {
      return { score: '0', level: RISK_LEVELS.LOW, avgLeverage: '1' };
    }

    const leverages = account.positions
      .filter((p) => p.status === 'Open')
      .map((p) => new Big(p.leverage));

    if (leverages.length === 0) {
      return { score: '0', level: RISK_LEVELS.LOW, avgLeverage: '1' };
    }

    const avgLeverage = leverages
      .reduce((sum, l) => sum.plus(l), new Big(0))
      .div(leverages.length);
    const maxLeverage = leverages.reduce(
      (max, l) => (l.gt(max) ? l : max),
      leverages[0],
    );

    const threshold = new Big(DEFAULT_RISK_CONFIG.LEVERAGE_THRESHOLD);
    let score = avgLeverage.div(threshold).times(100);
    if (score.gt(100)) score = new Big(100);

    return {
      success: true,
      data: {
        metric: RISK_METRICS.LEVERAGE_RATIO,
        score: score.toFixed(2),
        level: getRiskLevel(score),
        averageLeverage: avgLeverage.toFixed(2),
        maxLeverage: maxLeverage.toFixed(2),
        threshold: DEFAULT_RISK_CONFIG.LEVERAGE_THRESHOLD,
        activePositions: leverages.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate leverage risk: ${error.message}`);
  }
}

/**
 * D. CALCULATE LIQUIDATION PROXIMITY RISK
 * Measures distance from liquidation
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} Liquidation risk metrics
 */
async function calculateLiquidationProximityRisk(userId) {
  try {
    const account = await MarginAccount.findOne({ userId });
    if (!account) {
      return { score: '0', level: RISK_LEVELS.LOW, marginRatio: '0' };
    }

    const marginRatio = new Big(account.marginRatio);
    const liquidationThreshold = new Big('5'); // 5% minimum

    if (marginRatio.lte(liquidationThreshold)) {
      return {
        success: true,
        data: {
          metric: RISK_METRICS.LIQUIDATION_PROXIMITY,
          score: '100',
          level: RISK_LEVELS.CRITICAL,
          marginRatio: account.marginRatio,
          liquidationThreshold: '5',
          atRisk: true,
        },
      };
    }

    const proximityPercent = liquidationThreshold.div(marginRatio).times(100);
    const score = proximityPercent;

    return {
      success: true,
      data: {
        metric: RISK_METRICS.LIQUIDATION_PROXIMITY,
        score: score.toFixed(2),
        level: getRiskLevel(score),
        marginRatio: account.marginRatio,
        liquidationThreshold: '5',
        proximityPercent: proximityPercent.toFixed(2),
        atRisk: false,
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate liquidation risk: ${error.message}`);
  }
}

/**
 * E. CALCULATE OVERALL RISK SCORE
 * Weighted combination of all risk metrics
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} Overall risk assessment
 */
async function calculateOverallRiskScore(userId) {
  try {
    const [concentration, leverage, liquidation] = await Promise.all([
      calculateConcentrationRisk(userId),
      calculateLeverageRisk(userId),
      calculateLiquidationProximityRisk(userId),
    ]);

    const concentrationScore = new Big(concentration.data?.score || '0');
    const leverageScore = new Big(leverage.data?.score || '0');
    const liquidationScore = new Big(liquidation.data?.score || '0');

    // Weighted average
    const w_conc = new Big(RISK_SCORE_WEIGHTS.CONCENTRATION);
    const w_lev = new Big(RISK_SCORE_WEIGHTS.LEVERAGE);
    const w_liq = new Big(RISK_SCORE_WEIGHTS.LIQUIDATION);

    const overallScore = concentrationScore
      .times(w_conc)
      .plus(leverageScore.times(w_lev))
      .plus(liquidationScore.times(w_liq));

    return {
      success: true,
      data: {
        overallScore: overallScore.toFixed(2),
        overallLevel: getRiskLevel(overallScore),
        components: {
          concentration: {
            score: concentration.data?.score || '0',
            level: concentration.data?.level || RISK_LEVELS.LOW,
          },
          leverage: {
            score: leverage.data?.score || '0',
            level: leverage.data?.level || RISK_LEVELS.LOW,
          },
          liquidation: {
            score: liquidation.data?.score || '0',
            level: liquidation.data?.level || RISK_LEVELS.LOW,
          },
        },
        weights: RISK_SCORE_WEIGHTS,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to calculate overall risk score: ${error.message}`);
  }
}

// ─── Risk Threshold Management ────────────────────────────────────────────────

/**
 * F. GET RISK CONFIG
 * Retrieve current risk configuration
 *
 * @param {string} [userId] - User ID (for custom config)
 * @returns {object} Risk configuration
 */
async function getRiskConfig(userId = null) {
  try {
    if (!userId) {
      return {
        success: true,
        data: {
          default: DEFAULT_RISK_CONFIG,
          weights: RISK_SCORE_WEIGHTS,
        },
      };
    }

    // Check for user-specific config
    const RiskConfig = require('../models/RiskConfig');
    const config = await RiskConfig.findOne({ userId });

    return {
      success: true,
      data: config || {
        default: DEFAULT_RISK_CONFIG,
        weights: RISK_SCORE_WEIGHTS,
      },
    };
  } catch (error) {
    throw new Error(`Failed to get risk config: ${error.message}`);
  }
}

/**
 * G. UPDATE RISK THRESHOLDS
 * Configure risk thresholds for user
 *
 * @param {string} userId - User ID
 * @param {object} thresholds - New thresholds
 * @returns {Promise<object>} Updated config
 */
async function updateRiskThresholds(userId, thresholds) {
  try {
    if (!userId || !thresholds) throw new Error('Invalid parameters');

    const RiskConfig = require('../models/RiskConfig');
    const config = await RiskConfig.findOneAndUpdate(
      { userId },
      {
        userId,
        thresholds: {
          ...DEFAULT_RISK_CONFIG,
          ...thresholds,
        },
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    return {
      success: true,
      data: config,
      message: 'Risk thresholds updated',
    };
  } catch (error) {
    throw new Error(`Failed to update thresholds: ${error.message}`);
  }
}

// ─── Risk Alerts ──────────────────────────────────────────────────────────────

/**
 * H. CHECK RISK TRIGGERS
 * Check if risk thresholds exceeded
 *
 * @param {string} userId - User ID
 * @returns {Promise<object>} Triggered alerts
 */
async function checkRiskTriggers(userId) {
  try {
    const riskScore = await calculateOverallRiskScore(userId);
    const config = await getRiskConfig(userId);

    const alerts = [];
    const score = new Big(riskScore.data.overallScore);

    // Check thresholds
    if (score.gte(75)) {
      alerts.push({
        type: 'CRITICAL_RISK',
        severity: 'CRITICAL',
        message: 'Overall risk score critical',
        score: riskScore.data.overallScore,
      });
    } else if (score.gte(50)) {
      alerts.push({
        type: 'HIGH_RISK',
        severity: 'HIGH',
        message: 'Overall risk score high',
        score: riskScore.data.overallScore,
      });
    }

    return {
      success: true,
      data: {
        userId,
        alerts,
        riskScore: riskScore.data.overallScore,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to check risk triggers: ${error.message}`);
  }
}

// ─── Risk Restrictions ────────────────────────────────────────────────────────

/**
 * I. CHECK RISK-BASED RESTRICTIONS
 * Determine if operations should be restricted
 *
 * @param {string} userId - User ID
 * @param {string} operation - Operation type (open, increase, etc)
 * @returns {Promise<object>} Restriction status
 */
async function checkRiskRestrictions(userId, operation) {
  try {
    const riskScore = await calculateOverallRiskScore(userId);
    const score = new Big(riskScore.data.overallScore);

    const restrictions = {
      canOpenPosition: true,
      canIncreasePosition: true,
      canBorrow: true,
      maxLeverageAllowed: '100',
      reason: null,
    };

    if (score.gte(75)) {
      restrictions.canOpenPosition = false;
      restrictions.canIncreasePosition = false;
      restrictions.canBorrow = false;
      restrictions.reason = 'Critical risk level - all operations restricted';
    } else if (score.gte(50)) {
      restrictions.maxLeverageAllowed = '10';
      restrictions.reason = 'High risk - reduced leverage allowed';
    } else if (score.gte(25)) {
      restrictions.maxLeverageAllowed = '50';
      restrictions.reason = 'Medium risk - moderate leverage allowed';
    }

    return {
      success: true,
      data: {
        userId,
        operation,
        riskScore: riskScore.data.overallScore,
        restrictions,
        isRestricted: !restrictions[`can${operation}`],
      },
    };
  } catch (error) {
    throw new Error(`Failed to check restrictions: ${error.message}`);
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * J. GET RISK METRICS
 * Comprehensive risk analytics
 *
 * @returns {Promise<object>} System-wide risk metrics
 */
async function getRiskMetrics() {
  try {
    const RiskScore = require('../models/RiskScore');

    const scores = await RiskScore.find().lean();
    if (scores.length === 0) {
      return {
        success: true,
        data: {
          summary: {
            totalUsers: 0,
            avgRiskScore: '0',
            criticalCount: 0,
            highRiskCount: 0,
          },
        },
      };
    }

    const avgScore = scores
      .reduce((sum, s) => new Big(sum).plus(new Big(s.score)), new Big(0))
      .div(scores.length);

    const distribution = {
      critical: scores.filter((s) => new Big(s.score).gte(75)).length,
      high: scores.filter(
        (s) => new Big(s.score).gte(50) && new Big(s.score).lt(75),
      ).length,
      medium: scores.filter(
        (s) => new Big(s.score).gte(25) && new Big(s.score).lt(50),
      ).length,
      low: scores.filter((s) => new Big(s.score).lt(25)).length,
    };

    return {
      success: true,
      data: {
        summary: {
          totalUsers: scores.length,
          avgRiskScore: avgScore.toFixed(2),
          distribution,
        },
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to get risk metrics: ${error.message}`);
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getRiskLevel(score) {
  const s = new Big(score);
  if (s.gte(75)) return RISK_LEVELS.CRITICAL;
  if (s.gte(50)) return RISK_LEVELS.HIGH;
  if (s.gte(25)) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

module.exports = {
  calculateConcentrationRisk,
  calculateVolatilityRisk,
  calculateLeverageRisk,
  calculateLiquidationProximityRisk,
  calculateOverallRiskScore,
  getRiskConfig,
  updateRiskThresholds,
  checkRiskTriggers,
  checkRiskRestrictions,
  getRiskMetrics,
  RISK_LEVELS,
  RISK_METRICS,
  DEFAULT_RISK_CONFIG,
};
