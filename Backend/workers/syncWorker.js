const cron = require('node-cron');
const { syncQueue, syncMarketData, getSyncStatus } = require('../services/syncService');

const startSyncWorker = () => {
  syncQueue.process(async (job) => {
    console.log('[SyncWorker] Processing sync job:', job.id);
    return await syncMarketData(job.data);
  });

  syncQueue.on('completed', (job, result) => {
    console.log(`[SyncWorker] Job ${job.id} completed successfully. Synced ${result.data.length} items.`);
  });

  syncQueue.on('failed', (job, error) => {
    console.error(`[SyncWorker] Job ${job.id} failed:`, error.message);
  });

  cron.schedule('*/10 * * * *', async () => {
    console.log('[SyncWorker] Scheduled sync job triggered');
    await syncMarketData({ incremental: true });
  });

  console.log('[SyncWorker] Market data sync worker started');
};

module.exports = { startSyncWorker };
