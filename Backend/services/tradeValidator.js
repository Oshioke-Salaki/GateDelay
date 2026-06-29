const Joi = require('joi');
const Big = require('big.js');
const Balance = require('../models/Balance');
const permissionService = require('./permissionService');
const riskService = require('./riskService');

/**
 * TRADE VALIDATOR SERVICE
 * Validates trade transactions before execution
 * Handles parameter validation, permissions, balances, and market conditions
 */

// ─── Validation Schemas ──────────────────────────────────────────────────────

const tradeSchemas = {
  placeOrder: Joi.object({
    userId: Joi.string().required(),
    pair: Joi.string().pattern(/^[A-Z]+-[A-Z]+$/).required(),
    side: Joi.string().valid('Buy', 'Sell').required(),
    type: Joi.string().valid('Market', 'Limit').required(),
    amount: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
    price: Joi.string().pattern(/^\d+(\.\d+)?$/).when('type', {
      is: 'Limit',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    timestamp: Joi.date().optional(),
  }),

  cancelOrder: Joi.object({
    userId: Joi.string().required(),
    orderId: Joi.string().required(),
  }),

  marginTrade: Joi.object({
    userId: Joi.string().required(),
    pair: Joi.string().required(),
    side: Joi.string().valid('Buy', 'Sell').required(),
    amount: Joi.string().required(),
    leverage: Joi.number().min(1).max(100).required(),
  }),
};

// ─── Trade Limits Configuration ──────────────────────────────────────────────

const TRADE_LIMITS = {
  MIN_TRADE_AMOUNT: '0.0001',
  MAX_TRADE_AMOUNT: '1000000',
  MIN_TRADE_PRICE: '0.00000001',
  MAX_TRADE_PRICE: '10000000',
  MAX_ORDERS_PER_USER: 1000,
  MAX_ORDERS_PER_MINUTE: 100,
  MAX_SLIPPAGE_PERCENT: 5, // 5% max slippage for market orders
};

// ─── Validation Log Store ────────────────────────────────────────────────────

const validationLogs = [];
const MAX_LOG_ENTRIES = 10000;

function logValidation(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  validationLogs.push(entry);

  // Trim logs if exceeding limit
  if (validationLogs.length > MAX_LOG_ENTRIES) {
    validationLogs.shift();
  }

  console.log(`[TradeValidator:${level}]`, message, data);
  return entry;
}

// ─── Core Validation Functions ───────────────────────────────────────────────

/**
 * Validate trade parameters using Joi schema
 */
async function validateParameters(tradeType, params) {
  try {
    const schema = tradeSchemas[tradeType];
    if (!schema) {
      throw new Error(`Unknown trade type: ${tradeType}`);
    }

    const { error, value } = schema.validate(params, { abortEarly: false });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));

      logValidation('error', 'Parameter validation failed', {
        tradeType,
        errors,
        params,
      });

      return {
        valid: false,
        errors,
        message: 'Invalid trade parameters',
      };
    }

    // Additional business logic validation
    if (tradeType === 'placeOrder') {
      const amountBig = new Big(value.amount);
      if (amountBig.lt(TRADE_LIMITS.MIN_TRADE_AMOUNT)) {
        logValidation('error', 'Amount below minimum', { amount: value.amount });
        return {
          valid: false,
          errors: [{ field: 'amount', message: `Minimum amount is ${TRADE_LIMITS.MIN_TRADE_AMOUNT}` }],
        };
      }

      if (amountBig.gt(TRADE_LIMITS.MAX_TRADE_AMOUNT)) {
        logValidation('error', 'Amount exceeds maximum', { amount: value.amount });
        return {
          valid: false,
          errors: [{ field: 'amount', message: `Maximum amount is ${TRADE_LIMITS.MAX_TRADE_AMOUNT}` }],
        };
      }

      if (value.type === 'Limit') {
        const priceBig = new Big(value.price);
        if (priceBig.lt(TRADE_LIMITS.MIN_TRADE_PRICE) || priceBig.gt(TRADE_LIMITS.MAX_TRADE_PRICE)) {
          logValidation('error', 'Price out of range', { price: value.price });
          return {
            valid: false,
            errors: [{ field: 'price', message: 'Price out of acceptable range' }],
          };
        }
      }
    }

    logValidation('info', 'Parameter validation passed', { tradeType, userId: params.userId });

    return {
      valid: true,
      value,
    };
  } catch (err) {
    logValidation('error', 'Validation exception', { error: err.message, tradeType });
    return {
      valid: false,
      errors: [{ field: 'general', message: err.message }],
    };
  }
}

/**
 * Check user permissions for trade operation
 */
async function validatePermissions(userId, operation = 'PLACE_ORDER') {
  try {
    const { allowed, reason } = await permissionService.validatePermission(userId, operation);

    if (!allowed) {
      logValidation('warn', 'Permission denied', { userId, operation, reason });
      return {
        valid: false,
        message: `Permission denied: ${reason}`,
        reason,
      };
    }

    logValidation('info', 'Permission check passed', { userId, operation });

    return {
      valid: true,
      operation,
    };
  } catch (err) {
    logValidation('error', 'Permission check failed', { userId, error: err.message });
    return {
      valid: false,
      message: 'Permission check error',
      error: err.message,
    };
  }
}

/**
 * Validate user has sufficient balance
 */
async function validateBalance(userId, asset, requiredAmount) {
  try {
    const balance = await Balance.findOne({ userId, asset }).lean();

    if (!balance) {
      logValidation('warn', 'Balance not found', { userId, asset });
      return {
        valid: false,
        message: `No balance found for asset: ${asset}`,
      };
    }

    const availableBig = new Big(balance.available);
    const requiredBig = new Big(requiredAmount);

    if (availableBig.lt(requiredBig)) {
      logValidation('warn', 'Insufficient balance', {
        userId,
        asset,
        available: balance.available,
        required: requiredAmount,
      });

      return {
        valid: false,
        message: 'Insufficient balance',
        available: balance.available,
        required: requiredAmount,
        shortfall: requiredBig.minus(availableBig).toString(),
      };
    }

    logValidation('info', 'Balance check passed', { userId, asset, required: requiredAmount });

    return {
      valid: true,
      available: balance.available,
      required: requiredAmount,
    };
  } catch (err) {
    logValidation('error', 'Balance check failed', { userId, asset, error: err.message });
    return {
      valid: false,
      message: 'Balance check error',
      error: err.message,
    };
  }
}

/**
 * Verify market conditions for trade
 */
async function validateMarketConditions(pair, side, type, price = null) {
  try {
    // Check if market is operational
    const marketStatus = await checkMarketStatus(pair);
    if (!marketStatus.operational) {
      logValidation('warn', 'Market not operational', { pair, reason: marketStatus.reason });
      return {
        valid: false,
        message: `Market not operational: ${marketStatus.reason}`,
      };
    }

    // For market orders, check if there's sufficient liquidity
    if (type === 'Market') {
      const liquidity = await checkMarketLiquidity(pair, side);
      if (!liquidity.sufficient) {
        logValidation('warn', 'Insufficient market liquidity', { pair, side });
        return {
          valid: false,
          message: 'Insufficient market liquidity',
          liquidity: liquidity.depth,
        };
      }
    }

    // For limit orders, validate price against market
    if (type === 'Limit' && price) {
      const priceCheck = await validateLimitPrice(pair, side, price);
      if (!priceCheck.valid) {
        logValidation('warn', 'Invalid limit price', { pair, side, price, reason: priceCheck.reason });
        return priceCheck;
      }
    }

    logValidation('info', 'Market conditions validated', { pair, side, type });

    return {
      valid: true,
      marketStatus: marketStatus.status,
    };
  } catch (err) {
    logValidation('error', 'Market condition check failed', { pair, error: err.message });
    return {
      valid: false,
      message: 'Market condition check error',
      error: err.message,
    };
  }
}

/**
 * Check if market is operational
 */
async function checkMarketStatus(pair) {
  // Check if market is paused or suspended
  const pauseService = require('./pauseService');
  const isPaused = await pauseService.isMarketPaused(pair).catch(() => false);

  if (isPaused) {
    return {
      operational: false,
      reason: 'Market is paused',
      status: 'paused',
    };
  }

  return {
    operational: true,
    status: 'active',
  };
}

/**
 * Check market liquidity depth
 */
async function checkMarketLiquidity(pair, side) {
  const Order = require('../models/Order');

  const oppositeSide = side === 'Buy' ? 'Sell' : 'Buy';
  const orderCount = await Order.countDocuments({
    pair,
    side: oppositeSide,
    status: { $in: ['Pending', 'Partial'] },
  });

  return {
    sufficient: orderCount > 0,
    depth: orderCount,
  };
}

/**
 * Validate limit order price
 */
async function validateLimitPrice(pair, side, price) {
  const oracleService = require('./oracleService');

  try {
    const [baseAsset] = pair.split('-');
    const marketPrice = await oracleService.getPrice(baseAsset);

    if (marketPrice) {
      const priceBig = new Big(price);
      const marketBig = new Big(marketPrice);
      const deviation = priceBig.minus(marketBig).abs().div(marketBig).times(100);

      if (deviation.gt(TRADE_LIMITS.MAX_SLIPPAGE_PERCENT * 5)) {
        return {
          valid: false,
          message: 'Limit price too far from market price',
          reason: 'excessive_deviation',
          deviation: deviation.toString(),
        };
      }
    }

    return { valid: true };
  } catch (err) {
    // If oracle fails, allow the trade (fail open for limit orders)
    return { valid: true };
  }
}

// ─── Main Validation Function ────────────────────────────────────────────────

/**
 * Complete trade validation
 * Validates all aspects of a trade before execution
 */
async function validateTrade(tradeData) {
  const validationResults = {
    valid: true,
    checks: {},
    errors: [],
    warnings: [],
  };

  try {
    // 1. Validate parameters
    const paramCheck = await validateParameters('placeOrder', tradeData);
    validationResults.checks.parameters = paramCheck;
    if (!paramCheck.valid) {
      validationResults.valid = false;
      validationResults.errors.push(...paramCheck.errors);
    }

    // 2. Check permissions
    const permCheck = await validatePermissions(tradeData.userId, 'PLACE_ORDER');
    validationResults.checks.permissions = permCheck;
    if (!permCheck.valid) {
      validationResults.valid = false;
      validationResults.errors.push({ field: 'permissions', message: permCheck.message });
    }

    // 3. Validate balance
    if (paramCheck.valid) {
      const [baseAsset, quoteAsset] = paramCheck.value.pair.split('-');
      const lockAsset = paramCheck.value.side === 'Buy' ? quoteAsset : baseAsset;
      
      let requiredAmount;
      if (paramCheck.value.side === 'Buy' && paramCheck.value.type === 'Limit') {
        requiredAmount = new Big(paramCheck.value.price).times(paramCheck.value.amount).toString();
      } else {
        requiredAmount = paramCheck.value.amount;
      }

      const balanceCheck = await validateBalance(tradeData.userId, lockAsset, requiredAmount);
      validationResults.checks.balance = balanceCheck;
      if (!balanceCheck.valid) {
        validationResults.valid = false;
        validationResults.errors.push({ field: 'balance', message: balanceCheck.message });
      }
    }

    // 4. Verify market conditions
    if (paramCheck.valid) {
      const marketCheck = await validateMarketConditions(
        paramCheck.value.pair,
        paramCheck.value.side,
        paramCheck.value.type,
        paramCheck.value.price
      );
      validationResults.checks.market = marketCheck;
      if (!marketCheck.valid) {
        validationResults.valid = false;
        validationResults.errors.push({ field: 'market', message: marketCheck.message });
      }
    }

    // 5. Risk checks (non-blocking warnings)
    try {
      const riskCheck = await riskService.assessTradeRisk(tradeData);
      validationResults.checks.risk = riskCheck;
      if (riskCheck.risk === 'HIGH') {
        validationResults.warnings.push({ field: 'risk', message: 'High risk trade detected' });
      }
    } catch (err) {
      // Risk check failure shouldn't block trade
      validationResults.warnings.push({ field: 'risk', message: 'Risk check unavailable' });
    }

    logValidation(
      validationResults.valid ? 'info' : 'warn',
      `Trade validation ${validationResults.valid ? 'passed' : 'failed'}`,
      {
        userId: tradeData.userId,
        pair: tradeData.pair,
        valid: validationResults.valid,
        errorCount: validationResults.errors.length,
      }
    );

    return validationResults;
  } catch (err) {
    logValidation('error', 'Trade validation exception', { error: err.message });
    return {
      valid: false,
      checks: validationResults.checks,
      errors: [{ field: 'general', message: `Validation error: ${err.message}` }],
      warnings: validationResults.warnings,
    };
  }
}

// ─── Validation Logs Management ──────────────────────────────────────────────

function getValidationLogs(filter = {}) {
  let logs = [...validationLogs];

  if (filter.userId) {
    logs = logs.filter((l) => l.userId === filter.userId);
  }

  if (filter.level) {
    logs = logs.filter((l) => l.level === filter.level);
  }

  if (filter.startTime) {
    logs = logs.filter((l) => new Date(l.timestamp) >= new Date(filter.startTime));
  }

  if (filter.endTime) {
    logs = logs.filter((l) => new Date(l.timestamp) <= new Date(filter.endTime));
  }

  return logs;
}

function clearValidationLogs() {
  const count = validationLogs.length;
  validationLogs.length = 0;
  return { cleared: count };
}

module.exports = {
  validateTrade,
  validateParameters,
  validatePermissions,
  validateBalance,
  validateMarketConditions,
  getValidationLogs,
  clearValidationLogs,
  TRADE_LIMITS,
};
