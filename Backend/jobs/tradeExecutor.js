const { log, withJobContext } = require('../utils/correlation');

const startTradeExecutor = async () => {
  const mongodbConfigured = Boolean(process.env.MONGODB_URI);
  const environment = process.env.NODE_ENV || 'development';

  withJobContext('tradeExecutor.start', {}, ({ requestId }) => {
    log('info', 'Starting trade executor', {
      requestId,
      environment,
      mongodbConfigured,
      scheduler: 'Agenda',
    });
  });

  try {
    const schedulerService = require('../services/schedulerService');
    await schedulerService.ready;
    log('info', 'Scheduler service loaded; scheduled trades are ready');
  } catch (error) {
    log('error', 'Failed to start scheduler service', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

module.exports = { startTradeExecutor };
