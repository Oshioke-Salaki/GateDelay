const { Referral, ReferralCode } = require('../models/Referral');
const OnChainTrade = require('../models/OnChainTrade');
const { MarketReferrerMapping } = require('../models/MarketReferrerMapping');
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

  /**
   * Resolve on-chain referrer address for a trader
   * Returns the referrer address from MarketReferrerMapping or null
   */
  async resolveOnChainReferrer(traderAddress) {
    const mapping = await MarketReferrerMapping.findOne({ trader: traderAddress });
    return mapping ? mapping.referrer : null;
  }

  /**
   * Link an on-chain referrer address to a referral record
   * Called when a MarketReferrerSet event is received
   */
  async linkOnChainReferrer(traderAddress, referrerAddress) {
    // Find the referral where this trader is the referred user
    const referral = await Referral.findOne({ referredId: traderAddress });
    if (referral) {
      referral.onChainReferrer = referrerAddress;
      await referral.save();
      return referral;
    }
    return null;
  }

  /**
   * Process an on-chain trade and attribute rebate to the referrer
   * Called after a TradeExecuted event is persisted
   */
  async processOnChainTradeRebate(tradeId) {
    const trade = await OnChainTrade.findById(tradeId);
    if (!trade || !trade.referrer) return null;

    const rebate = new Big(trade.rebate || '0');
    if (rebate.lte(0)) return null;

    // Find referral record for the trader
    const referral = await Referral.findOne({ referredId: trade.trader });
    if (!referral) return null;

    // Update accumulated rebate
    const oldRebate = new Big(referral.totalRebateEarned || '0');
    referral.totalRebateEarned = oldRebate.plus(rebate).toString();
    await referral.save();

    // Update referrer's total rewards
    const referrerCode = await ReferralCode.findOne({ userId: referral.referrerId });
    if (referrerCode) {
      const oldRewards = new Big(referrerCode.totalRewards || '0');
      referrerCode.totalRewards = oldRewards.plus(rebate).toString();
      await referrerCode.save();
    }

    return {
      trader: trade.trader,
      referrer: trade.referrer,
      rebate: trade.rebate,
      commission: trade.commission,
      tradeId: trade._id,
    };
  }

  /**
   * Get on-chain rebate summary for a referrer
   */
  async getOnChainRebateStats(referrerAddress) {
    const trades = await OnChainTrade.find({ referrer: referrerAddress })
      .sort({ createdAt: -1 })
      .limit(100);

    const totalRebate = trades.reduce(
      (sum, t) => sum.plus(new Big(t.rebate || '0')),
      new Big(0),
    );
    const totalCommission = trades.reduce(
      (sum, t) => sum.plus(new Big(t.commission || '0')),
      new Big(0),
    );
    const totalTrades = trades.length;

    return {
      referrer: referrerAddress,
      totalRebate: totalRebate.toString(),
      totalCommission: totalCommission.toString(),
      totalTrades,
      recentTrades: trades.slice(0, 10),
    };
  }
}

module.exports = new ReferralService();
