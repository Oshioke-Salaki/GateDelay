const { Referral, ReferralCode } = require('../models/Referral');
const Order = require('../models/Order');
const crypto = require('crypto');
const Big = require('big.js');

class ReferralService {
  /**
   * Generate a unique referral code for a user
   */
  async generateCode(userId) {
    let existing = await ReferralCode.findOne({ userId });
    if (existing) return existing.code;

    let code;
    let isUnique = false;
    while (!isUnique) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const duplicate = await ReferralCode.findOne({ code });
      if (!duplicate) isUnique = true;
    }

    const newCode = new ReferralCode({ userId, code });
    await newCode.save();
    return code;
  }

  /**
   * Register a new referral relationship
   */
  async registerReferral(referrerCode, referredId) {
    const referralEntry = await ReferralCode.findOne({ code: referrerCode });
    if (!referralEntry) throw new Error('Invalid referral code');
    if (referralEntry.userId === referredId) throw new Error('Cannot refer yourself');

    const existing = await Referral.findOne({ referredId });
    if (existing) throw new Error('User already referred');

    const referral = new Referral({
      referrerId: referralEntry.userId,
      referredId,
      referralCode: referrerCode
    });

    await referral.save();
    
    // Increment total referrals for the referrer
    await ReferralCode.updateOne(
      { userId: referralEntry.userId },
      { $inc: { totalReferrals: 1 } }
    );

    return referral;
  }

  /**
   * Calculate and update rewards based on trade volume
   * Reward = 10% of trading volume (mock logic)
   */
  async updateReferralRewards(referredId) {
    const referral = await Referral.findOne({ referredId });
    if (!referral) return;

    // Get total filled volume for the referred user
    const orders = await Order.find({ userId: referredId, status: 'Filled' });
    const totalVolume = orders.reduce((sum, o) => sum.plus(o.filled), new Big(0));
    
    // Reward is 1% of volume (for example)
    const reward = totalVolume.times(0.01).toString();
    
    const oldReward = new Big(referral.rewardEarned);
    const newReward = new Big(reward);
    const delta = newReward.minus(oldReward);

    if (delta.gt(0)) {
      referral.rewardEarned = reward;
      await referral.save();

      await ReferralCode.updateOne(
        { userId: referral.referrerId },
        { $set: { totalRewards: reward } } // Simplified: in real app, sum all referrals
      );
      
      // Correct way to sum all rewards for the referrer
      const allReferrals = await Referral.find({ referrerId: referral.referrerId });
      const totalRewards = allReferrals.reduce((sum, r) => sum.plus(r.rewardEarned), new Big(0));
      
      await ReferralCode.updateOne(
        { userId: referral.referrerId },
        { totalRewards: totalRewards.toString() }
      );
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId) {
    const codeEntry = await ReferralCode.findOne({ userId });
    if (!codeEntry) return { totalReferrals: 0, totalRewards: '0', code: null };

    const referrals = await Referral.find({ referrerId: userId }).select('referredId joinedAt rewardEarned');
    
    return {
      code: codeEntry.code,
      totalReferrals: codeEntry.totalReferrals,
      totalRewards: codeEntry.totalRewards,
      referrals
    };
  }

  /**
   * Get referral analytics (conversions over time)
   */
  async getReferralAnalytics(userId) {
    const analytics = await Referral.aggregate([
      { $match: { referrerId: userId } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$joinedAt" } },
          count: { $sum: 1 },
          rewards: { $sum: { $toDouble: "$rewardEarned" } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return analytics;
  }
}

module.exports = new ReferralService();
