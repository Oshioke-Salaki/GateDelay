const cron = require('node-cron');
const arbitrageService = require('../services/arbitrageService');

/**
 * ARBITRAGE MONITOR JOB
 * Periodically scans markets for arbitrage opportunities and logs alerts.
 */

const startArbitrageMonitor = () => {
  // Scan every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    console.log('[ArbitrageMonitor] Scanning markets for arbitrage opportunities...');

    try {
      const opportunities = await arbitrageService.detectOpportunities();
      const profitable = opportunities.filter((o) => o.isProfitable);

      console.log(
        `[ArbitrageMonitor] Found ${opportunities.length} opportunities, ${profitable.length} profitable`
      );

      for (const opp of profitable) {
        console.log(
          `[ArbitrageMonitor] ALERT: ${opp.pair} — buy ${opp.buyMarket} @ ${opp.buyPrice}, sell ${opp.sellMarket} @ ${opp.sellPrice} | net profit/unit: $${opp.estimatedNetProfitPerUnit.toFixed(2)}`
        );
      }
    } catch (error) {
      console.error('[ArbitrageMonitor] Scan error:', error.message);
    }
  });

  console.log('[ArbitrageMonitor] Arbitrage monitor started (Every 30s)');
};

module.exports = { startArbitrageMonitor };
