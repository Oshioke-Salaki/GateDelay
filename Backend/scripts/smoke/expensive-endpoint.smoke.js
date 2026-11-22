const assert = require('node:assert');

// Smoke for Backend/middleware/expensiveEndpointGuard.js — verifies the
// expensive endpoint guard middleware and service load correctly and expose
// the expected API surface.

async function main() {
  const { expensiveEndpointGuard, strictExpensiveGuard, expensiveEndpointService } = require('../../middleware/expensiveEndpointGuard');

  // Middleware factories
  assert.strictEqual(typeof expensiveEndpointGuard, 'function', 'expensiveEndpointGuard should be a function');
  assert.strictEqual(typeof strictExpensiveGuard, 'function', 'strictExpensiveGuard should be a function');

  // Service API
  assert.strictEqual(typeof expensiveEndpointService.trackRequest, 'function', 'trackRequest should be a function');
  assert.strictEqual(typeof expensiveEndpointService.detectAbusePatterns, 'function', 'detectAbusePatterns should be a function');
  assert.strictEqual(typeof expensiveEndpointService.getEndpointCost, 'function', 'getEndpointCost should be a function');
  assert.strictEqual(typeof expensiveEndpointService.extractIdentifiers, 'function', 'extractIdentifiers should be a function');
  assert.strictEqual(typeof expensiveEndpointService.getClientIp, 'function', 'getClientIp should be a function');
  assert.strictEqual(typeof expensiveEndpointService.getAnalytics, 'function', 'getAnalytics should be a function');
  assert.strictEqual(typeof expensiveEndpointService.getTopAbusers, 'function', 'getTopAbusers should be a function');
  assert.strictEqual(typeof expensiveEndpointService.clearIdentifier, 'function', 'clearIdentifier should be a function');
  assert.strictEqual(typeof expensiveEndpointService.getConfig, 'function', 'getConfig should be a function');
  assert.strictEqual(typeof expensiveEndpointService.updatePatterns, 'function', 'updatePatterns should be a function');
  assert.strictEqual(typeof expensiveEndpointService.setEndpointCost, 'function', 'setEndpointCost should be a function');

  // Verify middleware factory returns a function
  const middleware = expensiveEndpointGuard();
  assert.strictEqual(typeof middleware, 'function', 'expensiveEndpointGuard() should return middleware function');
  assert.strictEqual(middleware.length, 3, 'middleware should accept (req, res, next)');

  // Verify strict guard returns a function
  const strictMiddleware = strictExpensiveGuard();
  assert.strictEqual(typeof strictMiddleware, 'function', 'strictExpensiveGuard() should return middleware function');

  // Verify endpoint cost classification
  const highCost = expensiveEndpointService.getEndpointCost('POST', '/api/trade-engine/orders');
  assert.strictEqual(highCost.cost, 'high', 'trade-engine orders should be high cost');

  const mediumCost = expensiveEndpointService.getEndpointCost('GET', '/api/markets');
  assert.strictEqual(mediumCost.cost, 'medium', 'markets should be medium cost');

  const lowCost = expensiveEndpointService.getEndpointCost('GET', '/api/health');
  assert.strictEqual(lowCost.cost, 'low', 'health should be low cost');

  // Verify identifier extraction
  const mockReq = {
    method: 'GET',
    path: '/api/markets',
    headers: { 'x-user-id': 'user-123', 'x-wallet-address': '0xabc', 'x-forwarded-for': '1.2.3.4' },
    user: { sub: 'user-123', walletAddress: '0xabc' },
  };
  const identifiers = expensiveEndpointService.extractIdentifiers(mockReq);
  assert.strictEqual(identifiers.userId, 'user-123');
  assert.strictEqual(identifiers.walletAddress, '0xabc');
  assert.strictEqual(identifiers.ip, '1.2.3.4');
  assert.strictEqual(identifiers.endpoint, 'GET /api/markets');

  // Verify IP extraction fallbacks
  const ipReq = {
    method: 'GET',
    path: '/test',
    headers: {},
    connection: { remoteAddress: '5.6.7.8' },
  };
  assert.strictEqual(expensiveEndpointService.getClientIp(ipReq), '5.6.7.8');

  // Verify config
  const config = expensiveEndpointService.getConfig();
  assert.ok(config.endpointCosts, 'config should have endpointCosts');
  assert.ok(config.patterns, 'config should have patterns');
  assert.ok(config.patterns.userBurst, 'config should have userBurst pattern');
  assert.ok(config.patterns.walletHopping, 'config should have walletHopping pattern');

  // Verify pattern update
  expensiveEndpointService.updatePatterns({ userBurst: { threshold: 100, window: 120 } });
  const updatedConfig = expensiveEndpointService.getConfig();
  assert.strictEqual(updatedConfig.patterns.userBurst.threshold, 100);

  // Verify custom endpoint cost
  expensiveEndpointService.setEndpointCost('GET /api/custom', { cost: 'high', limit: 5, window: 30 });
  const customCost = expensiveEndpointService.getEndpointCost('GET', '/api/custom');
  assert.strictEqual(customCost.cost, 'high');
  assert.strictEqual(customCost.limit, 5);

  console.log('EXPENSIVE_ENDPOINT_GUARD_SMOKE_PASS');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
