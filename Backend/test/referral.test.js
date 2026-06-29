const referralService = require('../services/referralService');
const { Referral, ReferralCode } = require('../models/Referral');
const Order = require('../models/Order');
const mongoose = require('mongoose');

jest.mock('../models/Referral');
jest.mock('../models/Order');

describe('Referral Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCode', () => {
    it('should return existing code if available', async () => {
      ReferralCode.findOne.mockResolvedValue({ code: 'ABC12345' });
      const code = await referralService.generateCode('user1');
      expect(code).toBe('ABC12345');
    });

    it('should generate a new unique code if none exists', async () => {
      ReferralCode.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      ReferralCode.prototype.save = jest.fn().mockResolvedValue(true);
      
      const code = await referralService.generateCode('user1');
      expect(code).toHaveLength(8);
      expect(ReferralCode.prototype.save).toHaveBeenCalled();
    });
  });

  describe('registerReferral', () => {
    it('should register a new referral relationship', async () => {
      ReferralCode.findOne = jest.fn().mockResolvedValue({ userId: 'referrer1', code: 'CODE1' });
      Referral.findOne = jest.fn().mockResolvedValue(null);
      Referral.prototype.save = jest.fn().mockResolvedValue(true);
      ReferralCode.updateOne = jest.fn().mockResolvedValue(true);

      const referral = await referralService.registerReferral('CODE1', 'referred1');
      
      expect(Referral).toHaveBeenCalled();
      expect(ReferralCode.updateOne).toHaveBeenCalledWith(
        { userId: 'referrer1' },
        { $inc: { totalReferrals: 1 } }
      );
    });

    it('should throw error for invalid code', async () => {
      ReferralCode.findOne = jest.fn().mockResolvedValue(null);
      await expect(referralService.registerReferral('INVALID', 'u1'))
        .rejects.toThrow('Invalid referral code');
    });
  });

  describe('updateReferralRewards', () => {
    it('should calculate rewards based on volume', async () => {
      const mockReferral = {
        referrerId: 'ref1',
        referredId: 'refr1',
        rewardEarned: '0',
        save: jest.fn()
      };
      Referral.findOne = jest.fn().mockResolvedValue(mockReferral);
      Order.find.mockResolvedValue([{ filled: '1000' }, { filled: '500' }]);
      Referral.find = jest.fn().mockResolvedValue([mockReferral]);
      ReferralCode.updateOne = jest.fn();

      await referralService.updateReferralRewards('refr1');

      expect(mockReferral.rewardEarned).toBe('15'); // 1% of 1500
      expect(mockReferral.save).toHaveBeenCalled();
    });
  });
});
