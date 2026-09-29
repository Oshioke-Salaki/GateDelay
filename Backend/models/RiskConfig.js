const mongoose = require('mongoose');

const RiskConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, indexed: true },
  thresholds: {
    PORTFOLIO_CONCENTRATION_THRESHOLD: String,
    VOLATILITY_THRESHOLD: String,
    LEVERAGE_THRESHOLD: String,
    LIQUIDATION_PROXIMITY_THRESHOLD: String,
    CORRELATION_THRESHOLD: String,
  },
  weights: {
    CONCENTRATION: String,
    VOLATILITY: String,
    LEVERAGE: String,
    LIQUIDATION: String,
    CORRELATION: String,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

RiskConfigSchema.index({ userId: 1 });

module.exports =
  mongoose.models.RiskConfig || mongoose.model('RiskConfig', RiskConfigSchema);
