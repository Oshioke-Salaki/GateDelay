const async = require('async');
const { Web3 } = require('web3');
const crypto = require('crypto');

/**
 * TRADE BATCH PROCESSOR
 * Handles collecting trades into batches, managing their state, and preparing them for execution.
 */

// In-memory queue for pending trades (In production, use Redis or MongoDB)
let pendingTradesQueue = [];
const batches = new Map();

const BATCH_CONFIG = {
  MAX_BATCH_SIZE: 10,
  BATCH_TIMEOUT_MS: 5000 // Process every 5 seconds if not full
};

/**
 * Add a trade to the pending queue
 * @param {object} tradeData 
 * @returns {string} tradeId
 */
function addTradeToQueue(tradeData) {
  const tradeId = crypto.randomUUID();
  const trade = {
    id: tradeId,
    ...tradeData,
    status: 'Queued',
    queuedAt: new Date().toISOString()
  };
  
  pendingTradesQueue.push(trade);
  return tradeId;
}

/**
 * Create a batch from current pending trades
 * @returns {object|null} batch
 */
function createBatch() {
  if (pendingTradesQueue.length === 0) return null;

  const batchSize = Math.min(pendingTradesQueue.length, BATCH_CONFIG.MAX_BATCH_SIZE);
  const tradesToBatch = pendingTradesQueue.splice(0, batchSize);
  
  const batchId = crypto.randomUUID();
  const batch = {
    id: batchId,
    trades: tradesToBatch,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    retryCount: 0
  };

  batches.set(batchId, batch);
  
  // Update trade status
  tradesToBatch.forEach(t => t.status = 'Batched');
  
  return batch;
}

/**
 * Get status of a batch
 * @param {string} batchId 
 */
function getBatchStatus(batchId) {
  const batch = batches.get(batchId);
  if (!batch) throw new Error('Batch not found');
  return batch;
}

/**
 * Mark batch as completed
 * @param {string} batchId 
 * @param {string} txHash 
 */
function markBatchCompleted(batchId, txHash) {
  const batch = batches.get(batchId);
  if (batch) {
    batch.status = 'Completed';
    batch.txHash = txHash;
    batch.completedAt = new Date().toISOString();
    batch.trades.forEach(t => t.status = 'Processed');
  }
}

/**
 * Mark batch as failed
 * @param {string} batchId 
 * @param {string} error 
 */
function markBatchFailed(batchId, error) {
  const batch = batches.get(batchId);
  if (batch) {
    batch.status = 'Failed';
    batch.error = error;
    batch.trades.forEach(t => t.status = 'Error');
  }
}

module.exports = {
  addTradeToQueue,
  createBatch,
  getBatchStatus,
  markBatchCompleted,
  markBatchFailed,
  BATCH_CONFIG
};
