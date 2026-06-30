const mongoose = require('mongoose');

const MarginCallSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, indexed: true },
    marginRatio: { type: String, required: true },
    healthScore: { type: String, required: true },
    type: {
      type: String,
      enum: ['MarginCall', 'MarginWarning', 'LiquidationRisk'],
      default: 'MarginCall',
    },
    status: {
      type: String,
      enum: ['Active', 'Resolved', 'Liquidated'],
      default: 'Active',
    },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

MarginCallSchema.index({ accountId: 1, status: 1 });

module.exports =
  mongoose.models.MarginCall || mongoose.model('MarginCall', MarginCallSchema);
