const mongoose = require('mongoose');

const LiquidationSchema = new mongoose.Schema(
  {
    // Position and collateral identification
    positionId: { type: String, required: true, indexed: true },
    collateralId: { type: String, required: true },
    userId: { type: String, required: true, indexed: true },
    assetSymbol: { type: String, required: true },

    // Collateral details at liquidation
    collateralAmount: { type: String, default: '0' },
    collateralValue: { type: String, default: '0' },
    borrowAmount: { type: String, default: '0' },
    collateralizationRatio: { type: String, default: '0' },

    // Execution details
    executionPrice: { type: String, default: '0' },
    executedAt: { type: Date, default: Date.now },

    // Penalty calculation
    penaltyPercent: { type: String, default: '5' }, // e.g., "5", "10", "15"
    penaltyAmount: { type: String, default: '0' }, // Actual penalty value

    // Distribution
    liquidatorAddress: { type: String, required: true },
    liquidatorBonus: { type: String, default: '0' },
    liquidatorPayout: { type: String, default: '0' },
    protocolFees: { type: String, default: '0' },

    // Distribution tracking
    distribution: {
      liquidationId: String,
      distributions: [
        {
          recipient: String,
          address: String,
          amount: String,
          reason: String,
          txHash: String,
        },
      ],
      totalDistributed: String,
      distributedAt: Date,
    },
    distributionStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Processed', 'Failed'],
      default: 'Pending',
    },

    // Status
    status: {
      type: String,
      enum: ['Pending', 'Executing', 'Completed', 'Failed', 'Cancelled'],
      default: 'Completed',
    },

    // Optional transaction hash
    txHash: { type: String, default: null },

    // Metadata
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

// Indexes for efficient queries
LiquidationSchema.index({ userId: 1, executedAt: -1 });
LiquidationSchema.index({ positionId: 1 });
LiquidationSchema.index({ status: 1 });
LiquidationSchema.index({ assetSymbol: 1 });
LiquidationSchema.index({ executedAt: -1 });

module.exports =
  mongoose.models.Liquidation ||
  mongoose.model('Liquidation', LiquidationSchema);
