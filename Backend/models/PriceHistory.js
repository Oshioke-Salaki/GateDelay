const mongoose = require('mongoose');

const PriceHistorySchema = new mongoose.Schema({
  pair: {
    type: String,
    required: true,
    index: true,
  },
  price: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: true,
    enum: ['CHAINLINK', 'API3', 'FALLBACK'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);
