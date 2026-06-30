/**
 * ARBITRAGE SERVICE
 * Detects and analyzes arbitrage opportunities across markets.
 *
 * Responsibilities:
 *  - Monitor price differences across markets
 *  - Calculate arbitrage profitability
 *  - Provide arbitrage alerts
 *  - Track arbitrage execution
 *  - Generate arbitrage reports
 */

// In-memory store for simulation (In production, backed by Mongoose + Redis)
const opportunities = new Map();
const executions = [];
const alerts = [];

const OPPORTUNITY_STATUS = {
  OPEN: 'Open',
  EXECUTED: 'Executed',
  EXPIRED: 'Expired',
  MISSED: 'Missed',
};

// Simulated market price feeds.
// In production these would be fetched from DEX APIs / oracle aggregators.
const MARKET_PRICES = {
  'MarketA': { 'WETH/USDC': 2500, 'WBTC/USDC': 40000, 'WETH/USDT': 2498 },
  'MarketB': { 'WETH/USDC': 2515, 'WBTC/USDC': 39950, 'WETH/USDT': 2510 },
  'MarketC': { 'WETH/USDC': 2490, 'WBTC/USDC': 40100, 'WETH/USDT': 2495 },
};

const GAS_COST_USD = 5; // Flat gas cost estimate per arb trade in USD

/**
 * Fetch current price for a pair on a given market.
 * @param {string} market
 * @param {string} pair
 * @returns {number}
 */
function getMarketPrice(market, pair) {
  const prices = MARKET_PRICES[market];
  if (!prices) throw new Error(`Unknown market: ${market}`);
  const price = prices[pair];
  if (price === undefined) throw new Error(`Pair ${pair} not available on ${market}`);
  return price;
}

/**
 * Scan all known markets for price differences on a given pair and return
 * detected opportunities.
 * @param {string} pair - e.g. 'WETH/USDC'
 * @returns {object[]} detected opportunities (may be empty if none are profitable)
 */
function scanPair(pair) {
  const markets = Object.keys(MARKET_PRICES);
  const found = [];

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const buyMarket = markets[i];
      const sellMarket = markets[j];

      let buyPrice, sellPrice;
      try {
        buyPrice = getMarketPrice(buyMarket, pair);
        sellPrice = getMarketPrice(sellMarket, pair);
      } catch {
        continue;
      }

      // Ensure buy < sell; swap if needed
      const [actualBuy, actualSell, actualBuyMkt, actualSellMkt] =
        buyPrice < sellPrice
          ? [buyPrice, sellPrice, buyMarket, sellMarket]
          : [sellPrice, buyPrice, sellMarket, buyMarket];

      const priceDiff = actualSell - actualBuy;
      const priceDiffPct = priceDiff / actualBuy;

      // Gross profit per unit minus gas
      const grossProfitPerUnit = priceDiff;
      const netProfitPerUnit = grossProfitPerUnit - GAS_COST_USD;
      const isProfitable = netProfitPerUnit > 0;

      if (priceDiffPct > 0) {
        found.push({
          pair,
          buyMarket: actualBuyMkt,
          sellMarket: actualSellMkt,
          buyPrice: actualBuy,
          sellPrice: actualSell,
          priceDifference: priceDiff,
          priceDifferencePercent: (priceDiffPct * 100).toFixed(4),
          estimatedNetProfitPerUnit: netProfitPerUnit,
          isProfitable,
          gasCostUSD: GAS_COST_USD,
        });
      }
    }
  }

  return found;
}

/**
 * Scan all markets for all known pairs and store new opportunities.
 * @returns {Promise<object[]>} newly detected opportunities
 */
async function detectOpportunities() {
  const pairs = new Set();
  for (const prices of Object.values(MARKET_PRICES)) {
    for (const pair of Object.keys(prices)) pairs.add(pair);
  }

  const newOpportunities = [];

  for (const pair of pairs) {
    const found = scanPair(pair);
    for (const opp of found) {
      const id = 'arb_' + Math.random().toString(36).substr(2, 9);
      const record = {
        id,
        ...opp,
        status: OPPORTUNITY_STATUS.OPEN,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30_000).toISOString(), // 30s window
      };
      opportunities.set(id, record);
      newOpportunities.push(record);

      if (opp.isProfitable) {
        triggerAlert(record);
      }
    }
  }

  return newOpportunities;
}

/**
 * Calculate profitability for a specific opportunity given an amount.
 * @param {string} opportunityId
 * @param {number} amountUnits - number of units to trade
 * @returns {Promise<object>}
 */
async function calculateProfitability(opportunityId, amountUnits) {
  const opp = opportunities.get(opportunityId);
  if (!opp) throw new Error('Opportunity not found');

  const units = Number(amountUnits);
  if (!Number.isFinite(units) || units <= 0) throw new Error(`Invalid amount: ${amountUnits}`);

  const grossProfit = opp.priceDifference * units;
  const totalGasCost = GAS_COST_USD * 2; // buy + sell legs
  const netProfit = grossProfit - totalGasCost;
  const roi = ((netProfit / (opp.buyPrice * units)) * 100).toFixed(4);

  return {
    opportunityId,
    pair: opp.pair,
    amountUnits: units,
    buyMarket: opp.buyMarket,
    sellMarket: opp.sellMarket,
    grossProfit,
    totalGasCost,
    netProfit,
    roiPercent: roi,
    isProfitable: netProfit > 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Record the execution of an arbitrage opportunity.
 * @param {string} opportunityId
 * @param {number} amountUnits
 * @param {object} [tx] - { txHashBuy, txHashSell }
 * @returns {Promise<object>}
 */
async function recordExecution(opportunityId, amountUnits, tx = {}) {
  const opp = opportunities.get(opportunityId);
  if (!opp) throw new Error('Opportunity not found');
  if (opp.status !== OPPORTUNITY_STATUS.OPEN) {
    throw new Error(`Opportunity is ${opp.status}, cannot execute`);
  }

  const profitability = await calculateProfitability(opportunityId, amountUnits);

  const execution = {
    id: 'exec_' + Math.random().toString(36).substr(2, 9),
    opportunityId,
    ...profitability,
    txHashBuy: tx.txHashBuy || null,
    txHashSell: tx.txHashSell || null,
    executedAt: new Date().toISOString(),
  };

  executions.push(execution);
  opp.status = OPPORTUNITY_STATUS.EXECUTED;
  opp.executionId = execution.id;

  return execution;
}

/**
 * Generate an arbitrage alert for a profitable opportunity.
 * @param {object} opportunity
 */
function triggerAlert(opportunity) {
  alerts.push({
    id: 'alert_' + Math.random().toString(36).substr(2, 9),
    opportunityId: opportunity.id,
    pair: opportunity.pair,
    estimatedNetProfitPerUnit: opportunity.estimatedNetProfitPerUnit,
    priceDifferencePercent: opportunity.priceDifferencePercent,
    message: `Arbitrage opportunity: ${opportunity.pair} — buy on ${opportunity.buyMarket} at ${opportunity.buyPrice}, sell on ${opportunity.sellMarket} at ${opportunity.sellPrice}`,
    triggeredAt: new Date().toISOString(),
  });
}

/**
 * Get all alerts.
 * @returns {Promise<object[]>}
 */
async function getAlerts() {
  return [...alerts].reverse();
}

/**
 * List opportunities, optionally filtered.
 * @param {object} [filter] - { status, pair, isProfitable }
 * @returns {Promise<object[]>}
 */
async function listOpportunities(filter = {}) {
  let results = Array.from(opportunities.values());
  if (filter.status) results = results.filter((o) => o.status === filter.status);
  if (filter.pair) results = results.filter((o) => o.pair === filter.pair);
  if (filter.isProfitable !== undefined) {
    const flag = filter.isProfitable === 'true' || filter.isProfitable === true;
    results = results.filter((o) => o.isProfitable === flag);
  }
  return results.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
}

/**
 * Generate an arbitrage report.
 * @returns {Promise<object>}
 */
async function generateReport() {
  const allOpps = Array.from(opportunities.values());
  const profitable = allOpps.filter((o) => o.isProfitable);
  const executed = executions;

  const totalNetProfit = executed.reduce((sum, e) => sum + e.netProfit, 0);
  const totalGrossProfit = executed.reduce((sum, e) => sum + e.grossProfit, 0);

  const byPair = {};
  for (const e of executed) {
    if (!byPair[e.pair]) byPair[e.pair] = { executions: 0, netProfit: 0 };
    byPair[e.pair].executions++;
    byPair[e.pair].netProfit += e.netProfit;
  }

  return {
    totalOpportunities: allOpps.length,
    profitableOpportunities: profitable.length,
    totalExecutions: executed.length,
    totalGrossProfit,
    totalNetProfit,
    profitByPair: byPair,
    successRate: allOpps.length > 0 ? (executed.length / allOpps.length).toFixed(2) : '0.00',
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  detectOpportunities,
  calculateProfitability,
  recordExecution,
  getAlerts,
  listOpportunities,
  generateReport,
  getMarketPrice,
  OPPORTUNITY_STATUS,
  MARKET_PRICES,
};
