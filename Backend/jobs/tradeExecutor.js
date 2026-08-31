const startTradeExecutor = async () => {
  const mongodbConfigured = Boolean(process.env.MONGODB_URI);
  const environment = process.env.NODE_ENV || 'development';

  console.log('[TradeExecutor] Starting trade executor', {
    environment,
    mongodbConfigured,
    scheduler: 'Agenda'
  });

  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.ready;
    console.log('[TradeExecutor] Scheduler service loaded; scheduled trades are ready');
  } catch (error) {
    console.error('[TradeExecutor] Failed to start scheduler service', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

module.exports = { startTradeExecutor };
