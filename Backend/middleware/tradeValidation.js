const Big = require('big.js');
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
async function validateTradeRequest(req, res, next) {
  try {
    // Extract trade data from request body
    const tradeData = {
      userId:
        req.body.userId ||
        req.user?.sub ||
        req.user?.userId ||
        req.headers['x-user-id'],
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
}

/**
 * Validate trade parameters only (lightweight check)
 * Use when you only need parameter validation without balance/permission checks
 */
function validateTradeParameters(tradeType = 'placeOrder') {
  return async (req, res, next) => {
    try {
      const validation = await tradeValidator.validateParameters(
        tradeType,
        req.body,
      );

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
async function validateTradeLimits(req, res, next) {
  try {
    const { amount, price, type } = req.body;
    const limits = tradeValidator.TRADE_LIMITS;

    const errors = [];

    // Validate amount. Tested against null/undefined/'' rather than
    // truthiness: `0` is falsy, so `if (amount)` skipped the MIN_TRADE_AMOUNT
    // floor for exactly the value it most needed to reject.
    if (amount !== undefined && amount !== null && amount !== '') {
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
    if (
      type === 'Limit' &&
      price !== undefined &&
      price !== null &&
      price !== ''
    ) {
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
    // `new Big(...)` throws on anything non-numeric. That is bad input, not a
    // server fault, so it must not surface as a 500.
    if (error instanceof Error && /\[big\.js\]/.test(error.message)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid numeric value',
        code: 'INVALID_NUMBER',
        errors: [{ field: 'amount|price', message: error.message }],
      });
    }

    console.error('Trade limits validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Limits validation error',
      code: 'VALIDATION_ERROR',
      message: error.message,
    });
  }
}

/**
 * Validate balance only
 * Checks if user has sufficient balance for the trade
 */
async function validateTradeBalance(req, res, next) {
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

    // `'BTC'.split('-')` yields ['BTC'], leaving quoteAsset undefined and the
    // balance lookup silently querying an undefined asset.
    const [baseAsset, quoteAsset] = String(pair).split('-');
    if (!baseAsset || !quoteAsset) {
      return res.status(400).json({
        success: false,
        error: 'Trading pair must be in BASE-QUOTE form, e.g. BTC-USDT',
        code: 'INVALID_PAIR',
      });
    }
    const lockAsset = side === 'Buy' ? quoteAsset : baseAsset;

    let requiredAmount;

    if (side === 'Buy' && type === 'Limit' && price) {
      requiredAmount = new Big(price).times(amount).toString();
    } else {
      requiredAmount = amount;
    }

    const balanceCheck = await tradeValidator.validateBalance(
      userId,
      lockAsset,
      requiredAmount,
    );

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
}

/**
 * Validate market conditions
 * Checks if market is operational and conditions are acceptable
 */
async function validateMarketStatus(req, res, next) {
  try {
    const { pair, side, type, price } = req.body;

    if (!pair) {
      return res.status(400).json({
        success: false,
        error: 'Trading pair required',
        code: 'MISSING_PAIR',
      });
    }

    const marketCheck = await tradeValidator.validateMarketConditions(
      pair,
      side,
      type,
      price,
    );

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
          // A validator that rejects the request answers it directly (e.g.
          // res.status(400).json(...)) and never calls next(). Waiting only on
          // next() therefore left this promise pending forever — the client got
          // its response, but the chain never settled and the closure leaked.
          // Settle on whichever happens first.
          let settled = false;
          const finish = (err) => {
            if (settled) return;
            settled = true;
            res.removeListener('finish', onFinish);
            if (err) reject(err);
            else resolve();
          };
          const onFinish = () => finish();

          res.once('finish', onFinish);
          validator(req, res, finish);
        });

        // Response already sent by that validator: stop, don't run the rest.
        if (res.headersSent) return;
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
