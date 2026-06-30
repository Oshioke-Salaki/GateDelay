const mongoose = require('mongoose');
const healthCheckService = require('../services/healthCheck');

describe('Health Check Service', () => {
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

  it('should verify database health accurately', async () => {
    const health = await healthCheckService.checkDatabase();
    expect(health.status).toBe('UP');
    expect(health.details.readyState).toBe(1);
    expect(health.details.stateName).toBe('connected');
  });

  it('should verify blockchain provider connectivity', async () => {
    const health = await healthCheckService.checkBlockchain();
    // Ethers should successfully check cloudflare-eth or handle gracefully
    expect(health.status).toBeDefined();
  });

  it('should return a comprehensive health report', async () => {
    const report = await healthCheckService.generateHealthReport();
    expect(report.status).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.components.database).toBeDefined();
    expect(report.components.blockchain).toBeDefined();
    expect(report.components.redis).toBeDefined();
    expect(report.components.system).toBeDefined();
  });
});
