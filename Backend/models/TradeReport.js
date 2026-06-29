const mongoose = require('mongoose');

const TradeReportSchema = new mongoose.Schema({
  reportId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  reportType: { 
    type: String, 
    enum: ['daily', 'weekly', 'monthly', 'custom', 'profit_loss', 'tax', 'performance'],
    required: true 
  },
  filters: {
    pair: { type: String },
    side: { type: String, enum: ['Buy', 'Sell'] },
    status: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    minAmount: { type: String },
    maxAmount: { type: String }
  },
  generatedAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  format: { 
    type: String, 
    enum: ['json', 'csv', 'excel', 'pdf'],
    default: 'excel' 
  },
  summary: {
    totalTrades: { type: Number, default: 0 },
    totalVolume: { type: String, default: '0' },
    totalBuyVolume: { type: String, default: '0' },
    totalSellVolume: { type: String, default: '0' },
    avgTradeSize: { type: String, default: '0' },
    profitLoss: { type: String, default: '0' },
    winRate: { type: Number, default: 0 },
    bestTrade: { type: String, default: '0' },
    worstTrade: { type: String, default: '0' }
  },
  analytics: {
    topPairs: [{ 
      pair: String, 
      volume: String, 
      tradeCount: Number 
    }],
    hourlyDistribution: [{ 
      hour: Number, 
      tradeCount: Number 
    }],
    performanceByPair: [{
      pair: String,
      profitLoss: String,
      winRate: Number
    }]
  },
  fileUrl: { type: String },
  fileSize: { type: Number },
  errorMessage: { type: String },
  expiresAt: { 
    type: Date,
    index: { expires: 0 } // TTL index - MongoDB will auto-delete when expiresAt is reached
  }
}, { timestamps: true });

// Index for efficient queries
TradeReportSchema.index({ userId: 1, generatedAt: -1 });
TradeReportSchema.index({ status: 1, generatedAt: -1 });
TradeReportSchema.index({ reportType: 1, userId: 1 });

module.exports = mongoose.models.TradeReport || mongoose.model('TradeReport', TradeReportSchema);
