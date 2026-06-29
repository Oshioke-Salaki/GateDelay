const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  referrerId: { type: String, required: true, index: true },
  referredId: { type: String, required: true, unique: true },
  referralCode: { type: String, required: true, index: true },
  status: { type: String, enum: ['Pending', 'Active', 'Completed'], default: 'Active' },
  rewardEarned: { type: String, default: '0' },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Store referral codes separately for fast lookup and generation
const ReferralCodeSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  totalReferrals: { type: Number, default: 0 },
  totalRewards: { type: String, default: '0' }
}, { timestamps: true });

const Referral = mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);
const ReferralCode = mongoose.models.ReferralCode || mongoose.model('ReferralCode', ReferralCodeSchema);

module.exports = { Referral, ReferralCode };
