const mongoose = require('mongoose');

const CollateralSchema = new mongoose.Schema(
  {
    // User and asset identification
    userId: { type: String, required: true, index: true },
    assetSymbol: { type: String, required: true },

    // Deposit details
    depositAmount: { type: String, default: '0' }, // Stored as string for precision
    depositValue: { type: String, default: '0' }, // USD value at deposit time
    depositTimestamp: { type: Date, default: Date.now },

    // Current state
    currentAmount: { type: String, default: '0' },
    currentValue: { type: String, default: '0' }, // Current market value

    // Collateralization ratio (percentage)
    collateralizationRatio: { type: String, default: '0' }, // e.g., "150" for 150%
    requiredRatio: { type: String, default: '150' }, // Minimum required ratio

    // Liquidation thresholds
    liquidationThreshold: { type: String, default: '120' }, // e.g., "120" for 120%
    isLiquidationTriggered: { type: Boolean, default: false },
    liquidationTimestamp: { type: Date, default: null },
    liquidationValue: { type: String, default: '0' },

    // Market data snapshots
    priceHistory: [
      {
        price: String,
        value: String,
        timestamp: Date,
      },
    ],

    // Status tracking
    status: {
      type: String,
      enum: ['Active', 'Pending', 'Liquidating', 'Liquidated', 'Withdrawn'],
      default: 'Active',
    },

    // Metadata
    linkedMarketIds: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

// Index for efficient queries
CollateralSchema.index({ userId: 1, status: 1 });
CollateralSchema.index({ userId: 1, assetSymbol: 1 });
CollateralSchema.index({ isLiquidationTriggered: 1, status: 1 });

module.exports =
  mongoose.models.Collateral || mongoose.model('Collateral', CollateralSchema);
