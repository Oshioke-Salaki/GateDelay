const assert = require('node:assert/strict');
const Balance = require('../models/Balance');
const balanceService = require('../services/balanceService');
const legacyRoutes = require('../routes/legacy');

assert.equal(Balance.modelName, 'Balance');
assert.equal(typeof balanceService.getBalances, 'function');
assert.equal(typeof balanceService.getBalance, 'function');
assert.ok(legacyRoutes);

console.log('BALANCE_INTEGRATION_SMOKE_PASS');
