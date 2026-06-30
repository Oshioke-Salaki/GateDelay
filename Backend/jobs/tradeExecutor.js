const schedulerService = require('../services/schedulerService');

const startTradeExecutor = async () => {
  console.log('[TradeExecutor] Starting trade executor...');
  // Agenda is initialized in schedulerService
  console.log('[TradeExecutor] Trade executor started');
};

module.exports = { startTradeExecutor };
