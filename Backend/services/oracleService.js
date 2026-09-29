// TODO: Quarantined - ethers not in package.json. Add dependency or implement alternative.
// const { ethers } = require('ethers');
const PriceHistory = require('../models/PriceHistory');

/**
 * ORACLE SERVICE
 * Handles price feed integration from multiple providers (Chainlink, API3)
 */

// Mock provider addresses - in production these would be fetched from config/env
const PROVIDERS = {
  CHAINLINK: {
    name: 'CHAINLINK',
    // Example AggregatorV3Interface addresses
    feeds: {
      'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c'
    }
  },
  API3: {
    name: 'API3',
    // Example API3 dAPI addresses
    feeds: {
      'ETH/USD': '0x26690F9f17FdC21D4193A04aDD203262923cf961',
      'BTC/USD': '0x995101E788358249454E54f48A962E8A63d8934C'
    }
  }
};

const AGGREGATOR_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

/**
 * Fetch price from Chainlink
 * @param {string} pair - e.g. "ETH/USD"
 * @param {object} provider - Ethers provider
 * @returns {Promise<string>}
 */
async function fetchChainlinkPrice(pair, provider) {
  const feedAddress = PROVIDERS.CHAINLINK.feeds[pair];
  if (!feedAddress) throw new Error(`No Chainlink feed for ${pair}`);

  try {
    const contract = new ethers.Contract(feedAddress, AGGREGATOR_ABI, provider);
    const [, answer, , updatedAt] = await contract.latestRoundData();
    
    // Validate staleness (e.g. 1 hour)
    const now = Math.floor(Date.now() / 1000);
    if (now - Number(updatedAt) > 3600) {
      console.warn(`Chainlink price for ${pair} is stale`);
    }

    return ethers.formatUnits(answer, 8); // Chainlink USD pairs usually have 8 decimals
  } catch (error) {
    console.error(`Chainlink fetch error for ${pair}:`, error.message);
    throw error;
  }
}

/**
 * Fetch price from API3
 * @param {string} pair - e.g. "ETH/USD"
 * @param {object} provider - Ethers provider
 * @returns {Promise<string>}
 */
async function fetchAPI3Price(pair, provider) {
  const feedAddress = PROVIDERS.API3.feeds[pair];
  if (!feedAddress) throw new Error(`No API3 feed for ${pair}`);

  try {
    // API3 Proxy logic usually involves reading from a proxy contract
    const contract = new ethers.Contract(feedAddress, ['function read() view returns (int224 value, uint32 timestamp)'], provider);
    const [value, timestamp] = await contract.read();

    const now = Math.floor(Date.now() / 1000);
    if (now - Number(timestamp) > 3600) {
      console.warn(`API3 price for ${pair} is stale`);
    }

    return ethers.formatUnits(value, 18); // API3 usually uses 18 decimals
  } catch (error) {
    console.error(`API3 fetch error for ${pair}:`, error.message);
    throw error;
  }
}

/**
 * Get latest price with multi-provider fallback
 * @param {string} pair - e.g. "ETH/USD"
 * @param {object} provider - Ethers provider
 * @returns {Promise<object>}
 */
const DEFAULT_MAX_ORACLE_AGE_SECONDS = 60;
const BORDERLINE_ORACLE_AGE_SECONDS = 30;

/**
 * Evaluate oracle price data freshness
 * @param {Date|string|number|object} oracleData - Timestamp, Date, or object with timestamp
 * @param {object} [options]
 * @param {number} [options.maxAgeSeconds] - Max acceptable age in seconds (default 60)
 * @param {number} [options.borderlineAgeSeconds] - Borderline age threshold in seconds (default 30)
 * @param {Date|number|string} [options.now] - Override current timestamp for testing
 * @returns {object} Freshness metrics and status
 */
function checkOracleFreshness(oracleData, options = {}) {
  const maxAgeSeconds =
    options.maxAgeSeconds ??
    parseInt(process.env.MAX_ORACLE_AGE_SECONDS || String(DEFAULT_MAX_ORACLE_AGE_SECONDS), 10);
  const borderlineAgeSeconds =
    options.borderlineAgeSeconds ??
    Math.min(BORDERLINE_ORACLE_AGE_SECONDS, Math.floor(maxAgeSeconds / 2));

  let oracleTime;
  let provider = 'UNKNOWN';

  if (oracleData instanceof Date) {
    oracleTime = oracleData;
  } else if (typeof oracleData === 'object' && oracleData !== null) {
    if (oracleData.provider || oracleData.source) {
      provider = oracleData.provider || oracleData.source;
    }
    oracleTime =
      oracleData.timestamp ||
      oracleData.oracleTimestamp ||
      oracleData.updatedAt ||
      oracleData.startedAt;
  } else {
    oracleTime = oracleData;
  }

  const timestampMs = oracleTime !== undefined && oracleTime !== null ? new Date(oracleTime).getTime() : NaN;
  const nowMs = options.now ? new Date(options.now).getTime() : Date.now();

  if (isNaN(timestampMs)) {
    return {
      oracleTimestamp: null,
      currentTime: new Date(nowMs).toISOString(),
      ageSeconds: null,
      maxAgeSeconds,
      isStale: true,
      isBorderline: false,
      status: 'stale',
      provider,
      message: 'Invalid or missing oracle timestamp',
    };
  }

  const ageSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  const isStale = ageSeconds > maxAgeSeconds;
  const isBorderline = !isStale && ageSeconds >= borderlineAgeSeconds;

  let status = 'fresh';
  let message = `Oracle data is fresh (${ageSeconds}s old)`;
  if (isStale) {
    status = 'stale';
    message = `Oracle data is stale (${ageSeconds}s old exceeds acceptable limit of ${maxAgeSeconds}s)`;
  } else if (isBorderline) {
    status = 'borderline';
    message = `Oracle data is approaching staleness threshold (${ageSeconds}s old, max ${maxAgeSeconds}s)`;
  }

  return {
    oracleTimestamp: new Date(timestampMs).toISOString(),
    currentTime: new Date(nowMs).toISOString(),
    ageSeconds,
    maxAgeSeconds,
    isStale,
    isBorderline,
    status,
    provider,
    message,
  };
}

/**
 * Get latest price with multi-provider fallback and freshness analysis
 * @param {string} pair - e.g. "ETH/USD"
 * @param {object} [provider] - Ethers provider
 * @param {object} [options] - Options e.g. { rejectIfStale: boolean, maxAgeSeconds: number, now: Date }
 * @returns {Promise<object>}
 */
async function getPrice(pair, provider, options = {}) {
  let price;
  let source;
  let oracleTimestamp = new Date();

  // Try Chainlink first
  try {
    const result = await fetchChainlinkPrice(pair, provider);
    price = typeof result === 'object' ? result.price : result;
    if (typeof result === 'object' && result.timestamp) {
      oracleTimestamp = new Date(result.timestamp * 1000);
    }
    source = 'CHAINLINK';
  } catch (e) {
    console.log(`Falling back to API3 for ${pair}`);
    // Fallback to API3
    try {
      const result = await fetchAPI3Price(pair, provider);
      price = typeof result === 'object' ? result.price : result;
      if (typeof result === 'object' && result.timestamp) {
        oracleTimestamp = new Date(result.timestamp * 1000);
      }
      source = 'API3';
    } catch (e2) {
      console.error(`All oracle providers failed for ${pair}`);
      // Final fallback: Get last known price from DB
      let lastPrice = null;
      try {
        lastPrice = await PriceHistory.findOne({ pair }).sort({ timestamp: -1 });
      } catch (dbErr) {
        lastPrice = null;
      }
      if (lastPrice) {
        oracleTimestamp = lastPrice.timestamp;
        source = 'FALLBACK';
        price = lastPrice.price;
      } else {
        throw new Error(`Price unavailable for ${pair}`);
      }
    }
  }

  // Validate price data
  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    throw new Error(`Invalid price received for ${pair}: ${price}`);
  }

  // Calculate freshness metrics
  const freshness = checkOracleFreshness(
    { timestamp: oracleTimestamp, provider: source },
    options
  );

  // Store historical data asynchronously
  PriceHistory.create({
    pair,
    price,
    provider: source,
    timestamp: oracleTimestamp
  }).catch(err => console.error('Failed to store price history:', err));

  if (options.rejectIfStale && freshness.isStale) {
    const err = new Error(`Stale oracle pricing data for ${pair}: ${freshness.message}`);
    err.code = 'STALE_ORACLE_DATA';
    err.oracleFreshness = freshness;
    throw err;
  }

  return {
    pair,
    price,
    source,
    timestamp: oracleTimestamp,
    freshness
  };
}

/**
 * Get historical prices for a pair
 * @param {string} pair 
 * @param {number} limit 
 */
async function getHistory(pair, limit = 100) {
  return PriceHistory.find({ pair })
    .sort({ timestamp: -1 })
    .limit(limit);
}

module.exports = {
  getPrice,
  getHistory,
  checkOracleFreshness,
  DEFAULT_MAX_ORACLE_AGE_SECONDS,
  BORDERLINE_ORACLE_AGE_SECONDS,
  PROVIDERS
};
