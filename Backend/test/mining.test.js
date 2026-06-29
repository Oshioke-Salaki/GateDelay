const miningService = require('../services/miningService');
const math = require('mathjs');

describe('Mining Service', () => {
  describe('getPrograms', () => {
    it('should return all available mining programs', () => {
      const programs = miningService.getPrograms();
      expect(Array.isArray(programs)).toBe(true);
      expect(programs.length).toBeGreaterThan(0);
      expect(programs[0]).toHaveProperty('id');
      expect(programs[0]).toHaveProperty('name');
    });
  });

  describe('calculateRewards', () => {
    it('should calculate rewards correctly based on APY and days', () => {
      const amount = '1000';
      const apy = 0.10; // 10%
      const days = 365;
      
      const rewards = miningService.calculateRewards(amount, apy, days);
      // 1000 * 0.10 * (365/365) = 100
      expect(parseFloat(rewards)).toBe(100);
    });

    it('should handle partial years correctly', () => {
      const amount = '1000';
      const apy = 0.10;
      const days = 182.5; // Half year
      
      const rewards = miningService.calculateRewards(amount, apy, days);
      expect(parseFloat(rewards)).toBe(50);
    });
  });

  describe('trackParticipation', () => {
    it('should return participation data for an address', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const participation = await miningService.trackParticipation(address);
      
      expect(Array.isArray(participation)).toBe(true);
      expect(participation.length).toBe(2);
      expect(participation[0]).toHaveProperty('programId');
      expect(participation[0]).toHaveProperty('pendingRewards');
    });
  });

  describe('distributeRewards', () => {
    it('should simulate reward distribution', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = await miningService.distributeRewards(address, 'GATE_ETH');
      
      expect(result.success).toBe(true);
      expect(result.recipient).toBe(address);
      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('amount');
    });

    it('should throw error for invalid program ID', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      await expect(miningService.distributeRewards(address, 'INVALID')).rejects.toThrow('Mining program not found');
    });
  });

  describe('getMiningStats', () => {
    it('should return overall stats when no programId is provided', async () => {
      const stats = await miningService.getMiningStats();
      expect(stats.programId).toBe('ALL');
      expect(stats).toHaveProperty('totalValueLocked');
    });

    it('should return program-specific stats', async () => {
      const stats = await miningService.getMiningStats('GATE_ETH');
      expect(stats.programId).toBe('GATE_ETH');
      expect(stats).toHaveProperty('totalValueLocked');
    });
  });
});
