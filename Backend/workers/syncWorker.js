const cron = require('node-cron');
const {
  syncQueue,
  syncMarketData,
  getSyncStatus,
} = require('../services/syncService');
const { log, withJobContext } = require('../utils/correlation');
const {
  recordQueueFailure,
  withRetry,
} = require('../services/jobRetryService');

const startSyncWorker = () => {
  syncQueue.process(async (job) => {
    return withJobContext(
      'syncWorker.process',
      {
        requestId: job.data?.requestId,
        correlationId: job.data?.correlationId,
      },
      async ({ requestId }) => {
        log('info', 'Processing sync job', { requestId, jobId: job.id });
        // The queue's own `attempts` handle the redelivery; this bounds the
        // in-process work and dead-letters a job that never completes (#913).
        return await withRetry(
          () => syncMarketData({ ...job.data, requestId }),
          {
            job: 'market-data-sync',
            queue: 'market-data-sync',
            jobId: String(job.id),
            payload: job.data,
          },
        );
      },
    );
  });

  syncQueue.on('completed', (job, result) => {
    log('info', 'Sync job completed', {
      requestId: job.data?.requestId,
      jobId: job.id,
      syncedItems: result.data.length,
    });
  });

  syncQueue.on('failed', (job, error) => {
    log('error', 'Sync job failed', {
      requestId: job.data?.requestId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts,
      error: error.message,
    });
    // Bull emits `failed` on every attempt; only the last one is terminal.
    recordQueueFailure(job, error, {
      queue: 'market-data-sync',
      job: 'market-data-sync',
    });
  });

  cron.schedule('*/10 * * * *', async () => {
    await withJobContext('syncWorker.schedule', {}, async ({ requestId }) => {
      log('info', 'Scheduled sync job triggered', { requestId });
      // A cron tick has no queue to retry it, so bound the retries here. The
      // catch keeps the schedule alive: the next tick retries the whole sync.
      await withRetry(() => syncMarketData({ incremental: true, requestId }), {
        job: 'market-data-sync-schedule',
        payload: { incremental: true },
      }).catch((error) => {
        log('error', 'Scheduled sync job gave up; waiting for the next tick', {
          requestId,
          error: error.message,
        });
      });
    });
  });

  log('info', 'Market data sync worker started');
};

module.exports = { startSyncWorker };
