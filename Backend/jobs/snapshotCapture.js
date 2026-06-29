const cron = require('node-cron');
const snapshotService = require('../services/snapshotService');
const Order = require('../models/Order');

/**
 * Scheduled job to capture market snapshots
 * Runs every hour
 */
const startSnapshotJob = () => {
  // Cron expression for every hour: '0 * * * *'
  cron.schedule('0 * * * *', async () => {
    console.log('[SnapshotJob] Starting hourly market snapshots...');
    
    try {
      // Get all active pairs from recent orders
      const pairs = await Order.distinct('pair', {
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      for (const pair of pairs) {
        await snapshotService.captureSnapshot(pair);
        console.log(`[SnapshotJob] Captured snapshot for ${pair}`);
      }

      // Cleanup snapshots older than 30 days
      const deletedCount = await snapshotService.cleanupSnapshots(30);
      if (deletedCount > 0) {
        console.log(`[SnapshotJob] Cleaned up ${deletedCount} old snapshots`);
      }
    } catch (error) {
      console.error('[SnapshotJob] Error during snapshot capture:', error);
    }
  });

  console.log('[SnapshotJob] Market snapshot job scheduled (Hourly)');
};

module.exports = { startSnapshotJob };
