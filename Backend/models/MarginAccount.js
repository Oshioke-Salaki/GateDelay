const mongoose = require('mongoose');

const MarginAccountSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, indexed: true },
    marginType: { type: String, enum: ['Isolated', 'Cross'], default: 'Cross' },

    // Balance and equity
    balance: { type: String, default: '0' },
    equity: { type: String, default: '0' },
    totalBorrows: { type: String, default: '0' },

    // Margin tracking
    usedMargin: { type: String, default: '0' },
    availableMargin: { type: String, default: '0' },
    marginRatio: { type: String, default: '0' },
    healthScore: { type: String, default: '100' },

    // Status
    marginStatus: {
      type: String,
      enum: ['Healthy', 'Warning', 'Danger', 'Critical', 'Liquidating'],
      default: 'Healthy',
    },
    marginCallActive: { type: Boolean, default: false },

    // Positions
    positions: [
      {
        symbol: String,
        side: String,
        leverage: String,
        collateral: String,
        entryPrice: String,
        currentPrice: String,
        positionSize: String,
        maintenanceMargin: String,
        liquidationPrice: String,
        pnl: String,
        status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
        openedAt: Date,
        closedAt: Date,
      },
    ],

    // Margin calls
    marginCalls: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MarginCall' }],

    // Configuration
    config: {
      INITIAL_MARGIN_RATIO: String,
      MAINTENANCE_MARGIN_RATIO: String,
      LIQUIDATION_MARGIN_RATIO: String,
      MARGIN_CALL_THRESHOLD: String,
    },
  },
  { timestamps: true },
);

MarginAccountSchema.index({ userId: 1 });
MarginAccountSchema.index({ marginStatus: 1 });

module.exports =
  mongoose.models.MarginAccount ||
  mongoose.model('MarginAccount', MarginAccountSchema);
