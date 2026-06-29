const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['Limit', 'Market', 'Stop-Loss'], required: true },
  side: { type: String, enum: ['Buy', 'Sell'], required: true },
  pair: { type: String, required: true },
  price: { type: String, default: '0' },
  amount: { type: String, required: true },
  filled: { type: String, default: '0' },
  status: { type: String, enum: ['Pending', 'Partial', 'Filled', 'Canceled'], default: 'Pending' },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
