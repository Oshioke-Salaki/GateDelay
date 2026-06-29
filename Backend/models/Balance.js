const mongoose = require('mongoose');

const BalanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  asset: { type: String, required: true },
  available: { type: String, default: '0' },
  locked: { type: String, default: '0' }
}, { timestamps: true });

module.exports = mongoose.models.Balance || mongoose.model('Balance', BalanceSchema);
