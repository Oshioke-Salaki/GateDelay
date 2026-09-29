const mongoose = require('mongoose');

const MarketReferrerMappingSchema = new mongoose.Schema({
  trader: { type: String, required: true, unique: true, index: true },
  referrer: { type: String, required: true, index: true },
  setAt: { type: Date, default: Date.now },
  txHash: { type: String },
}, { timestamps: true });

const MarketReferrerMapping = mongoose.models.MarketReferrerMapping ||
  mongoose.model('MarketReferrerMapping', MarketReferrerMappingSchema);

module.exports = MarketReferrerMapping;
