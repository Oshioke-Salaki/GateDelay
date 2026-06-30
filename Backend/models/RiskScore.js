const mongoose = require('mongoose');

const RiskScoreSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, indexed: true },
    score: { type: String, required: true },
    level: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
    },
    components: {
      concentration: { score: String, level: String },
      leverage: { score: String, level: String },
      liquidation: { score: String, level: String },
      volatility: { score: String, level: String },
    },
    alerts: [String],
    restrictions: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

RiskScoreSchema.index({ userId: 1, timestamp: -1 });
RiskScoreSchema.index({ level: 1 });

module.exports =
  mongoose.models.RiskScore || mongoose.model('RiskScore', RiskScoreSchema);
