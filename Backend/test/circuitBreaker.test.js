'use strict';

/**
 * CIRCUIT BREAKER TEST SUITE (#920)
 *
 * Covers:
 *  - Core state machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 *  - Failure threshold, success threshold, and trip logic
 *  - executeWithBreaker: timeout protection and fallback handlers
 *  - Bridge service integration (initiateTransfer + circuit breaker)
 *  - Swap service integration (getQuote + circuit breaker)
 *  - Trade engine integration (processOrder + circuit breaker)
 *  - Recovery scenario: half-open probe success closes breaker
 *  - Fallback returns correct shape when breaker is OPEN
 */

// ── We mock ioredis to avoid real connections ─────────────────────────────────

jest.mock('ioredis', () => {
  const store = new Map();
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key) => store.get(key) ?? null),
    set: jest.fn(async (key, val) => { store.set(key, val); return 'OK'; }),
    on: jest.fn(),
    _store: store,
  }));
});

// ── Service under test ────────────────────────────────────────────────────────

const breakerService = require('../services/breakerService');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tripByFailures(serviceName, threshold) {
  for (let i = 0; i < threshold; i++) {
    await breakerService.recordFailure(serviceName, new Error('Failure ' + (i + 1)));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Circuit Breaker Core State Machine', () => {
  const SVC = 'test-svc-state';

  beforeEach(async () => {
    await breakerService.resetBreaker(SVC);
  });

  it('starts CLOSED with zero failure / success counts', async () => {
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.CLOSED);
    expect(state.failureCount).toBe(0);
    expect(state.successCount).toBe(0);
  });

  it('increments failureCount on each failure below threshold', async () => {
    await breakerService.recordFailure(SVC, new Error('e1'));
    await breakerService.recordFailure(SVC, new Error('e2'));
    const state = await breakerService.getBreakerState(SVC);
    expect(state.failureCount).toBe(2);
    expect(state.state).toBe(breakerService.BREAKER_STATE.CLOSED);
  });

  it('trips OPEN once failure threshold is reached', async () => {
    await tripByFailures(SVC, breakerService.BREAKER_CONFIG.FAILURE_THRESHOLD);
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.OPEN);
    expect(state.tripCount).toBeGreaterThanOrEqual(1);
  });

  it('blocks execution when OPEN', async () => {
    await breakerService.tripBreaker(SVC, 'test trip');
    const check = await breakerService.isServiceAllowed(SVC);
    expect(check.allowed).toBe(false);
    expect(check.state).toBe(breakerService.BREAKER_STATE.OPEN);
    expect(typeof check.retryAfter).toBe('number');
  });

  it('throws with code CIRCUIT_BREAKER_OPEN when OPEN', async () => {
    await breakerService.tripBreaker(SVC, 'blocking');
    await expect(
      breakerService.executeWithBreaker(SVC, async () => 'should not run')
    ).rejects.toMatchObject({ code: 'CIRCUIT_BREAKER_OPEN' });
  });

  it('transitions to HALF_OPEN after attemptHalfOpen', async () => {
    await breakerService.tripBreaker(SVC, 'force open');
    await breakerService.attemptHalfOpen(SVC);
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.HALF_OPEN);
  });

  it('closes breaker after enough successes in HALF_OPEN', async () => {
    await breakerService.tripBreaker(SVC, 'open');
    await breakerService.attemptHalfOpen(SVC);
    for (let i = 0; i < breakerService.BREAKER_CONFIG.SUCCESS_THRESHOLD; i++) {
      await breakerService.recordSuccess(SVC);
    }
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.CLOSED);
    expect(state.failureCount).toBe(0);
    expect(state.successCount).toBe(0);
  });

  it('re-opens breaker on failure during HALF_OPEN', async () => {
    await breakerService.tripBreaker(SVC, 'open');
    await breakerService.attemptHalfOpen(SVC);
    await breakerService.recordFailure(SVC, new Error('probe failed'));
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.OPEN);
  });

  it('resetBreaker forces CLOSED and clears counts', async () => {
    await breakerService.tripBreaker(SVC, 'trip');
    await breakerService.resetBreaker(SVC);
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.CLOSED);
    expect(state.failureCount).toBe(0);
  });

  it('isolateService forces OPEN', async () => {
    await breakerService.isolateService(SVC, 'manual isolation');
    const state = await breakerService.getBreakerState(SVC);
    expect(state.state).toBe(breakerService.BREAKER_STATE.OPEN);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('executeWithBreaker – timeout and fallback', () => {
  const SVC = 'test-svc-exec';

  beforeEach(async () => {
    await breakerService.resetBreaker(SVC);
  });

  it('returns result of fn when call succeeds', async () => {
    const result = await breakerService.executeWithBreaker(SVC, async () => 42);
    expect(result).toBe(42);
  });

  it('records failure and rethrows when fn throws', async () => {
    await expect(
      breakerService.executeWithBreaker(SVC, async () => { throw new Error('downstream error'); })
    ).rejects.toThrow('downstream error');
    const state = await breakerService.getBreakerState(SVC);
    expect(state.failureCount).toBeGreaterThanOrEqual(1);
  });

  it('times out and records failure when fn hangs past timeoutMs', async () => {
    await expect(
      breakerService.executeWithBreaker(
        SVC,
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
        { timeoutMs: 50 }
      )
    ).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    const state = await breakerService.getBreakerState(SVC);
    expect(state.failureCount).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('calls fallback handler when fn throws and fallback is provided', async () => {
    const fallbackResult = { status: 'fallback' };
    const result = await breakerService.executeWithBreaker(
      SVC,
      async () => { throw new Error('boom'); },
      { fallback: async () => fallbackResult }
    );
    expect(result).toBe(fallbackResult);
  });

  it('calls fallback handler when breaker is OPEN', async () => {
    await breakerService.tripBreaker(SVC, 'open for fallback test');
    const fallbackResult = { status: 'open-fallback' };
    const result = await breakerService.executeWithBreaker(
      SVC,
      async () => 'should not run',
      { fallback: async () => fallbackResult }
    );
    expect(result).toBe(fallbackResult);
  });

  it('getAllBreakerStatus returns summary with counts', async () => {
    const status = await breakerService.getAllBreakerStatus();
    expect(typeof status.summary.total).toBe('number');
    expect(typeof status.summary.open).toBe('number');
    expect(typeof status.summary.closed).toBe('number');
    expect(typeof status.summary.halfOpen).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Bridge Service – circuit breaker integration', () => {
  const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const sender = '0x0000000000000000000000000000000000000001';
  const validParams = {
    protocol: 'WORMHOLE',
    sourceChain: 'ethereum',
    destChain: 'solana',
    token: 'USDC',
    amount: 100,
    sender,
    recipient,
  };

  let bridgeService;

  beforeAll(() => {
    bridgeService = require('../services/bridgeService');
  });

  it('initiates a valid transfer through the circuit breaker', async () => {
    await breakerService.resetBreaker('bridge-wormhole');
    const transfer = await bridgeService.initiateTransfer(validParams);
    expect(transfer.id).toMatch(/^brg_/);
    expect(transfer.status).toBe(bridgeService.TRANSFER_STATUS.PENDING);
  });

  it('still rejects invalid protocol (validation runs before breaker fn)', async () => {
    await expect(
      bridgeService.initiateTransfer({ ...validParams, protocol: 'BOGUS' })
    ).rejects.toThrow(/Unsupported bridge protocol/);
  });

  it('falls back gracefully when useFallback is set and breaker is OPEN', async () => {
    const svcName = 'bridge-wormhole';
    await breakerService.resetBreaker(svcName);
    for (let i = 0; i < breakerService.BREAKER_CONFIG.FAILURE_THRESHOLD; i++) {
      await breakerService.recordFailure(svcName, new Error('fail ' + i));
    }
    const result = await bridgeService.initiateTransfer(validParams, { useFallback: true });
    expect(result.isFallback).toBe(true);
    expect(result.circuitState).toBe('OPEN');
    expect(result.status).toBe(bridgeService.TRANSFER_STATUS.FAILED);
    await breakerService.resetBreaker(svcName);
  });

  it('getBridgeAnalytics includes circuitBreakers summary', async () => {
    const analytics = await bridgeService.getBridgeAnalytics();
    expect(analytics.circuitBreakers).toBeDefined();
    expect(typeof analytics.circuitBreakers.total).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Swap Service – circuit breaker integration', () => {
  let swapService;

  beforeAll(() => {
    swapService = require('../services/swapService');
  });

  beforeEach(async () => {
    await breakerService.resetBreaker('swap-service');
  });

  it('returns a valid quote when breaker is CLOSED', async () => {
    const quote = await swapService.getQuote({ tokenIn: 'USDC', tokenOut: 'WETH', amountIn: 1000 });
    expect(quote.tokenIn).toBe('USDC');
    expect(quote.tokenOut).toBe('WETH');
    expect(quote.amountOut).toBeGreaterThan(0);
  });

  it('trips breaker after threshold failures', async () => {
    for (let i = 0; i < breakerService.BREAKER_CONFIG.FAILURE_THRESHOLD; i++) {
      await breakerService.recordFailure('swap-service', new Error('swap fail ' + i));
    }
    const state = await breakerService.getBreakerState('swap-service');
    expect(state.state).toBe(breakerService.BREAKER_STATE.OPEN);
  });

  it('blocks getQuote when swap-service breaker is OPEN', async () => {
    await breakerService.tripBreaker('swap-service', 'open for swap test');
    await expect(
      swapService.getQuote({ tokenIn: 'USDC', tokenOut: 'WETH', amountIn: 500 })
    ).rejects.toMatchObject({ code: 'CIRCUIT_BREAKER_OPEN' });
  });

  it('uses fallback when getQuote is blocked', async () => {
    await breakerService.tripBreaker('swap-service', 'forced');
    const fallbackData = { status: 'unavailable' };
    const result = await swapService.getQuote(
      { tokenIn: 'USDC', tokenOut: 'WETH', amountIn: 500 },
      { fallback: async () => fallbackData }
    );
    expect(result).toBe(fallbackData);
  });

  it('resumes normal operation after breaker is reset', async () => {
    await breakerService.tripBreaker('swap-service', 'temp trip');
    await breakerService.resetBreaker('swap-service');
    const quote = await swapService.getQuote({ tokenIn: 'USDC', tokenOut: 'WETH', amountIn: 100 });
    expect(quote.amountOut).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Trade Engine – circuit breaker integration', () => {
  const mongoose = require('mongoose');

  beforeEach(async () => {
    jest.clearAllMocks();
    mongoose.startSession = jest.fn().mockResolvedValue({
      withTransaction: async (cb) => { await cb(); },
      endSession: jest.fn(),
      inTransaction: () => true,
    });
    await breakerService.resetBreaker('trade-engine');
  });

  it('blocks processOrder when trade-engine breaker is OPEN', async () => {
    await breakerService.tripBreaker('trade-engine', 'forced for test');
    const tradeEngine = require('../services/tradeEngine');
    await expect(
      tradeEngine.processOrder({
        userId: 'u1',
        side: 'Buy',
        type: 'Limit',
        pair: 'ETH-USDT',
        amount: '1',
        price: '2000',
      })
    ).rejects.toMatchObject({ code: 'CIRCUIT_BREAKER_OPEN' });
  });

  it('processOrder with fallback returns fallback when OPEN', async () => {
    await breakerService.tripBreaker('trade-engine', 'open');
    const tradeEngine = require('../services/tradeEngine');
    const fallbackResp = { order: null, matches: [], blocked: true };
    const result = await tradeEngine.processOrder(
      { userId: 'u1', side: 'Buy', type: 'Limit', pair: 'ETH-USDT', amount: '1', price: '2000' },
      { fallback: async () => fallbackResp }
    );
    expect(result).toBe(fallbackResp);
  });

  it('trip then full recovery: OPEN → HALF_OPEN → CLOSED', async () => {
    const threshold = breakerService.BREAKER_CONFIG.FAILURE_THRESHOLD;
    for (let i = 0; i < threshold; i++) {
      await breakerService.recordFailure('trade-engine', new Error('e' + i));
    }
    let state = await breakerService.getBreakerState('trade-engine');
    expect(state.state).toBe(breakerService.BREAKER_STATE.OPEN);

    await breakerService.attemptHalfOpen('trade-engine');
    state = await breakerService.getBreakerState('trade-engine');
    expect(state.state).toBe(breakerService.BREAKER_STATE.HALF_OPEN);

    for (let i = 0; i < breakerService.BREAKER_CONFIG.SUCCESS_THRESHOLD; i++) {
      await breakerService.recordSuccess('trade-engine');
    }
    state = await breakerService.getBreakerState('trade-engine');
    expect(state.state).toBe(breakerService.BREAKER_STATE.CLOSED);
    expect(state.tripCount).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activation history', () => {
  const SVC = 'test-history-svc';

  beforeEach(async () => {
    await breakerService.resetBreaker(SVC);
  });

  it('records a trip event in history', async () => {
    await breakerService.tripBreaker(SVC, 'history-test');
    const history = breakerService.getActivationHistory({ serviceName: SVC });
    const tripEntry = history.find((h) => h.action === 'trip');
    expect(tripEntry).toBeDefined();
    expect(tripEntry.reason).toBe('history-test');
  });

  it('records a close event in history after reset', async () => {
    await breakerService.tripBreaker(SVC, 'trip-before-reset');
    await breakerService.resetBreaker(SVC);
    const history = breakerService.getActivationHistory({ serviceName: SVC });
    const closeEntry = history.find((h) => h.action === 'close');
    expect(closeEntry).toBeDefined();
  });

  it('filters history by action type', async () => {
    await breakerService.tripBreaker(SVC, 'trip1');
    await breakerService.attemptHalfOpen(SVC);
    const halfOpenEntries = breakerService.getActivationHistory({ action: 'half_open' });
    expect(halfOpenEntries.every((h) => h.action === 'half_open')).toBe(true);
  });
});
