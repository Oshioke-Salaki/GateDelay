const Balance = require('../models/Balance');

async function getBalances(userId, asset) {
  const query = { userId };
  if (asset) query.asset = asset;
  return Balance.find(query).sort({ asset: 1 }).lean();
}

async function getBalance(userId, asset) {
  return Balance.findOne({ userId, asset }).lean();
}

module.exports = { getBalances, getBalance };
