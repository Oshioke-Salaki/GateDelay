const mongoose = require('mongoose');

const MarketSnapshotSchema = new mongoose.Schema({
  pair: { type: String, required: true },
  price: { type: String, required: true },
  volume24h: { type: String, required: true },
  high24h: { type: String, required: true },
  low24h: { type: String, required: true },
  orderBook: {
    bids: [{ price: String, amount: String }],
    asks: [{ price: String, amount: String }]
  },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient time-range queries per pair
MarketSnapshotSchema.index({ pair: 1, timestamp: -1 });

module.exports = mongoose.models.MarketSnapshot || mongoose.model('MarketSnapshot', MarketSnapshotSchema);
