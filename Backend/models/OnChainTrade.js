const mongoose = require('mongoose');

const OnChainTradeSchema = new mongoose.Schema({
  txHash: { type: String, required: true, index: true },
  blockNumber: { type: Number, required: true },
  contractAddress: { type: String, required: true },
  trader: { type: String, required: true, index: true },
  marketId: { type: String, required: true, index: true },
  outcome: { type: String, required: true },
  isBuy: { type: Boolean, required: true },
  shares: { type: String, required: true },
  collateralAmount: { type: String, required: true },
  fee: { type: String, default: '0' },
  rebate: { type: String, default: '0' },
  commission: { type: String, default: '0' },
  referrer: { type: String, default: null, index: true },
}, { timestamps: true });

OnChainTradeSchema.index({ trader: 1, createdAt: -1 });
OnChainTradeSchema.index({ referrer: 1, createdAt: -1 });
OnChainTradeSchema.index({ txHash: 1 }, { unique: true });

const OnChainTrade = mongoose.models.OnChainTrade || mongoose.model('OnChainTrade', OnChainTradeSchema);

module.exports = OnChainTrade;
