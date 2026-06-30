const mongoose = require('mongoose');
const statusService = require('../services/statusService');

describe('Market Status Service', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gatedelay_test');
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  const marketId = 'ETH-USD-TEST';

  it('should initialize status to ACTIVE on first get', async () => {
    const res = await statusService.getMarketStatus(marketId);
    expect(res.success).toBe(true);
    expect(res.marketId).toBe(marketId);
    expect(res.status).toBe('ACTIVE');
  });

  it('should track status updates and transitions', async () => {
    // Transition ACTIVE -> PAUSED
    const updateRes = await statusService.updateMarketStatus({
      marketId,
      status: 'PAUSED',
      operatorId: 'admin-1',
      notes: 'Market risk threshold reached',
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.data.status).toBe('PAUSED');
    expect(updateRes.data.updatedBy).toBe('admin-1');

    // Retrieve current status
    const current = await statusService.getMarketStatus(marketId);
    expect(current.status).toBe('PAUSED');
    expect(current.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should fetch status change history', async () => {
    const historyRes = await statusService.getStatusHistory({ marketId });
    expect(historyRes.success).toBe(true);
    expect(historyRes.data.history.length).toBeGreaterThanOrEqual(1);

    const logEntry = historyRes.data.history[0];
    expect(logEntry.fromStatus).toBe('ACTIVE');
    expect(logEntry.toStatus).toBe('PAUSED');
    expect(logEntry.changedBy).toBe('admin-1');
  });
});
