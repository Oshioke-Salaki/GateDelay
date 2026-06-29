const tradeValidator = require('../services/tradeValidator');

/**
 * TRADE VALIDATION MIDDLEWARE
 * Express middleware for validating trades before they reach route handlers
 * Integrates with tradeValidator service
 */

/**
 * Validate trade request middleware
 * Performs comprehensive validation on incoming trade requests
 */
function validateTradeRequest(req, res, next) {
  const handler = async () => {
    try {
      // Extract trade data from request body
      const tradeData = {
        userId: req.body.userId || req.user?.sub || req.user?.userId || req.headers['x-user-id'],
        pair: req.body.pair,
        side: req.body.side,
        type: req.body.type,
        amount: req.body.amount,
        price: req.body.price,
        timestamp: req.body.timestamp || new Date(),
      };

      // Validate trade
      const validation = await tradeValidator.validateTrade(tradeData);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Trade validation failed',
          code: 'VALIDATION_FAILED',
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Attach validation results to request for downstream use
      req.tradeValidation = validation;
      req.validatedTradeData = tradeData;

      // Include warnings in response headers if present
      if (validation.warnings.length > 0) {
        res.setHeader('X-Trade-Warnings', JSON.stringify(validation.warnings));
      }

      next();
    } catch (error) {
      console.error('Trade validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Trade validation error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
  };

  handler();
}

/**
 * Validate trade parameters only (lightweight check)
 * Use when you only need parameter validation without balance/permission checks
 */
function validateTradeParameters(tradeType = 'placeOrder') {
  return async (req, res, next) => {
    try {
      const validation = await tradeValidator.validateParameters(tradeType, req.body);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid trade parameters',
          code: 'INVALID_PARAMETERS',
          errors: validation.errors,
        });
      }

      req.validatedParams = validation.value;
      next();
    } catch (error) {
      console.error('Parameter validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Parameter validation error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
  };
}

/**
 * Validate trade limits
 * Checks if trade amount and price are within acceptable limits
 */
function validateTradeLimits(req, res, next) {
  const handler = async () => {
    try {
      const { amount, price, type } = req.body;
      const limits = tradeValidator.TRADE_LIMITS;

      const errors = [];

      // Validate amount
      if (amount) {
        const Big = require('big.js');
        const amountBig = new Big(amount);

        if (amountBig.lt(limits.MIN_TRADE_AMOUNT)) {
          errors.push({
            field: 'amount',
            message: `Amount must be at least ${limits.MIN_TRADE_AMOUNT}`,
          });
        }

        if (amountBig.gt(limits.MAX_TRADE_AMOUNT)) {
          errors.push({
            field: 'amount',
            message: `Amount cannot exceed ${limits.MAX_TRADE_AMOUNT}`,
          });
        }
      }

      // Validate price for limit orders
      if (type === 'Limit' && price) {
        const Big = require('big.js');
        const priceBig = new Big(price);

        if (priceBig.lt(limits.MIN_TRADE_PRICE)) {
          errors.push({
            field: 'price',
            message: `Price must be at least ${limits.MIN_TRADE_PRICE}`,
          });
        }

        if (priceBig.gt(limits.MAX_TRADE_PRICE)) {
          errors.push({
            field: 'price',
            message: `Price cannot exceed ${limits.MAX_TRADE_PRICE}`,
          });
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Trade limits exceeded',
          code: 'LIMITS_EXCEEDED',
          errors,
        });
      }

      next();
    } catch (error) {
      console.error('Trade limits validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Limits validation error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
  };

  handler();
}

/**
 * Validate balance only
 * Checks if user has sufficient balance for the trade
 */
function validateTradeBalance(req, res, next) {
  const handler = async () => {
    try {
      const userId = req.body.userId || req.user?.sub || req.user?.userId;
      const { pair, side, amount, price, type } = req.body;

      if (!userId || !pair || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
        });
      }

      const [baseAsset, quoteAsset] = pair.split('-');
      const lockAsset = side === 'Buy' ? quoteAsset : baseAsset;

      const Big = require('big.js');
      let requiredAmount;
      
      if (side === 'Buy' && type === 'Limit' && price) {
        requiredAmount = new Big(price).times(amount).toString();
      } else {
        requiredAmount = amount;
      }

      const balanceCheck = await tradeValidator.validateBalance(userId, lockAsset, requiredAmount);

      if (!balanceCheck.valid) {
        return res.status(400).json({
          success: false,
          error: balanceCheck.message,
          code: 'INSUFFICIENT_BALANCE',
          available: balanceCheck.available,
          required: balanceCheck.required,
          shortfall: balanceCheck.shortfall,
        });
      }

      req.balanceCheck = balanceCheck;
      next();
    } catch (error) {
      console.error('Balance validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Balance validation error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
  };

  handler();
}

/**
 * Validate market conditions
 * Checks if market is operational and conditions are acceptable
 */
function validateMarketStatus(req, res, next) {
  const handler = async () => {
    try {
      const { pair, side, type, price } = req.body;

      if (!pair) {
        return res.status(400).json({
          success: false,
          error: 'Trading pair required',
          code: 'MISSING_PAIR',
        });
      }

      const marketCheck = await tradeValidator.validateMarketConditions(pair, side, type, price);

      if (!marketCheck.valid) {
        return res.status(400).json({
          success: false,
          error: marketCheck.message,
          code: 'MARKET_UNAVAILABLE',
          details: marketCheck,
        });
      }

      req.marketCheck = marketCheck;
      next();
    } catch (error) {
      console.error('Market validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Market validation error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
  };

  handler();
}

/**
 * Combine multiple validation middlewares
 * Allows chaining specific validations
 */
function validateTrade(...validators) {
  return (req, res, next) => {
    const runValidators = async () => {
      for (const validator of validators) {
        await new Promise((resolve, reject) => {
          validator(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      next();
    };

    runValidators().catch(next);
  };
}

module.exports = {
  validateTradeRequest,
  validateTradeParameters,
  validateTradeLimits,
  validateTradeBalance,
  validateMarketStatus,
  validateTrade,
};
