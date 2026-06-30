const mongoose = require('mongoose');
const deployService = require('../services/deployService');

describe('Deploy Service', () => {
  beforeAll(async () => {
    // Connect to in-memory db if available, otherwise just use a mock or standard connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gatedelay_test');
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('triggerDeployment', () => {
    it('should validate inputs correctly', async () => {
      await expect(
        deployService.triggerDeployment({ env: 'invalid-env', version: 'v1.0.0', operatorId: 'op1' })
      ).rejects.toThrow('Invalid or missing environment');

      await expect(
        deployService.triggerDeployment({ env: 'production', version: '', operatorId: 'op1' })
      ).rejects.toThrow('Version must be a non-empty string');

      await expect(
        deployService.triggerDeployment({ env: 'production', version: 'v1.0.0', operatorId: '' })
      ).rejects.toThrow('operatorId is required');
    });

    it('should successfully trigger a dry-run deployment', async () => {
      const result = await deployService.triggerDeployment({
        env: 'development',
        version: 'v1.0.0-test',
        operatorId: 'op-admin',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.data.status).toBe('DEPLOYING');

      // Wait a moment for process exit simulation to trigger status update
      await new Promise(resolve => setTimeout(resolve, 500));

      const updated = await deployService.getDeployment(result.deploymentId);
      expect(updated.data.status).toBe('SUCCESS');
    });

    it('should handle simulated rollout failures with rollback', async () => {
      const result = await deployService.triggerDeployment({
        env: 'production',
        version: 'fail-rollout', // triggers simulation failure in deploy.js
        operatorId: 'op-admin',
        dryRun: true,
      });

      expect(result.success).toBe(true);

      // Wait for async execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updated = await deployService.getDeployment(result.deploymentId);
      expect(updated.data.status).toBe('ROLLED_BACK');
      expect(updated.data.logs.join('\n')).toContain('Initiating rollback process');
    });
  });

  describe('listDeployments', () => {
    it('should list and filter deployments successfully', async () => {
      const list = await deployService.listDeployments({ env: 'development' });
      expect(list.success).toBe(true);
      expect(Array.isArray(list.data.deployments)).toBe(true);
    });
  });
});
