const cron = require('node-cron');
const async = require('async');
const batchProcessor = require('../services/batchProcessor');

/**
 * BATCH EXECUTOR JOB
 * Periodically checks for pending trades, creates batches, and executes them atomically.
 */

const startBatchExecutor = () => {
  // Run every 5 seconds (configurable via batchProcessor.BATCH_CONFIG)
  cron.schedule('*/5 * * * * *', async () => {
    const batch = batchProcessor.createBatch();
    
    if (!batch) return;

    console.log(`[BatchExecutor] Processing batch ${batch.id} with ${batch.trades.length} trades...`);

    try {
      // Process trades in batch using 'async' library for control flow
      // In production, this would be an atomic smart contract call (e.g., multicall)
      await executeBatchAtomically(batch);
      
      const mockTxHash = '0x' + Math.random().toString(16).slice(2, 66);
      batchProcessor.markBatchCompleted(batch.id, mockTxHash);
      
      console.log(`[BatchExecutor] Batch ${batch.id} completed successfully. Tx: ${mockTxHash}`);
    } catch (error) {
      console.error(`[BatchExecutor] Batch ${batch.id} failed:`, error.message);
      batchProcessor.markBatchFailed(batch.id, error.message);
      
      // Graceful failure handling: In production, we might want to re-queue specific trades
      handleBatchFailure(batch);
    }
  });

  console.log('[BatchExecutor] Trade batch processor job started (Every 5s)');
};

/**
 * Simulates atomic execution of a batch
 * @param {object} batch 
 */
async function executeBatchAtomically(batch) {
  return new Promise((resolve, reject) => {
    // Using async.eachSeries to simulate atomic sequential processing
    // or async.parallel if the blockchain interaction supports it.
    async.eachSeries(batch.trades, (trade, callback) => {
      // Simulate validation and processing
      if (trade.amount <= 0) {
        return callback(new Error(`Invalid amount for trade ${trade.id}`));
      }
      
      // Simulate small delay
      setTimeout(() => {
        console.log(`  - Trade ${trade.id} validated`);
        callback();
      }, 50);
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Handle batch failure gracefully
 * @param {object} batch 
 */
function handleBatchFailure(batch) {
  console.log(`[BatchExecutor] Handling failure for batch ${batch.id}. Re-queueing valid trades...`);
  // Simple logic: re-queue trades that didn't cause the failure
  // In this mock, we just log it.
}

module.exports = { startBatchExecutor };
