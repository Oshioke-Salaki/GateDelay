const { ethers } = require('ethers');
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
async function getPrice(pair, provider) {
  let price;
  let source;

  // Try Chainlink first
  try {
    price = await fetchChainlinkPrice(pair, provider);
    source = 'CHAINLINK';
  } catch (e) {
    console.log(`Falling back to API3 for ${pair}`);
    // Fallback to API3
    try {
      price = await fetchAPI3Price(pair, provider);
      source = 'API3';
    } catch (e2) {
      console.error(`All oracle providers failed for ${pair}`);
      // Final fallback: Get last known price from DB
      const lastPrice = await PriceHistory.findOne({ pair }).sort({ timestamp: -1 });
      if (lastPrice) {
        return {
          pair,
          price: lastPrice.price,
          source: 'FALLBACK_DB',
          timestamp: lastPrice.timestamp
        };
      }
      throw new Error(`Price unavailable for ${pair}`);
    }
  }

  // Validate price data
  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    throw new Error(`Invalid price received for ${pair}: ${price}`);
  }

  // Store historical data asynchronously
  PriceHistory.create({
    pair,
    price,
    provider: source,
    timestamp: new Date()
  }).catch(err => console.error('Failed to store price history:', err));

  return {
    pair,
    price,
    source,
    timestamp: new Date()
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
  PROVIDERS
};
