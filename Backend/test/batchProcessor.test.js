const batchProcessor = require('../services/batchProcessor');

describe('Batch Processor Service', () => {
  beforeEach(() => {
    // Reset queue for each test (since it's in-memory)
    // In a real app we'd have a reset method or use a real DB
  });

  it('should add trades to queue', () => {
    const tradeId = batchProcessor.addTradeToQueue({ pair: 'ETH-USDT', amount: 1.5 });
    expect(tradeId).toBeDefined();
  });

  it('should create batches of limited size', () => {
    // Add 15 trades
    for (let i = 0; i < 15; i++) {
      batchProcessor.addTradeToQueue({ pair: 'ETH-USDT', amount: i + 1 });
    }

    const batch = batchProcessor.createBatch();
    expect(batch).toBeDefined();
    expect(batch.trades.length).toBe(batchProcessor.BATCH_CONFIG.MAX_BATCH_SIZE);
    expect(batch.status).toBe('Pending');
  });

  it('should track batch status accurately', () => {
    const tradeId = batchProcessor.addTradeToQueue({ pair: 'BTC-USDT', amount: 0.5 });
    const batch = batchProcessor.createBatch();
    
    batchProcessor.markBatchCompleted(batch.id, '0xHash');
    
    const updatedBatch = batchProcessor.getBatchStatus(batch.id);
    expect(updatedBatch.status).toBe('Completed');
    expect(updatedBatch.txHash).toBe('0xHash');
    expect(updatedBatch.trades[0].status).toBe('Processed');
  });

  it('should handle batch failures', () => {
    const tradeId = batchProcessor.addTradeToQueue({ pair: 'BTC-USDT', amount: 0.5 });
    const batch = batchProcessor.createBatch();
    
    batchProcessor.markBatchFailed(batch.id, 'Network Error');
    
    const updatedBatch = batchProcessor.getBatchStatus(batch.id);
    expect(updatedBatch.status).toBe('Failed');
    expect(updatedBatch.error).toBe('Network Error');
    expect(updatedBatch.trades[0].status).toBe('Error');
  });
});
