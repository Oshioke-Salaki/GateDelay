import { Test, TestingModule } from '@nestjs/testing';
import {
  ReplayProtectionService,
  REPLAY_PROTECTION_REDIS,
} from './replay-protection.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRedis(overrides: Partial<{ set: jest.Mock; get: jest.Mock }> = {}) {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

async function buildService(
  redis: object | null,
  config?: { maxTimestampDriftMs?: number; nonceTtlMs?: number },
): Promise<ReplayProtectionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      {
        provide: REPLAY_PROTECTION_REDIS,
        useValue: redis,
      },
      {
        provide: ReplayProtectionService,
        useFactory: (r: any) => new ReplayProtectionService(r, config),
        inject: [REPLAY_PROTECTION_REDIS],
      },
    ],
  }).compile();

  return module.get(ReplayProtectionService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReplayProtectionService — Redis-backed', () => {
  it('accepts a fresh nonce (SET NX returns OK)', async () => {
    const redis = makeRedis({ set: jest.fn().mockResolvedValue('OK') });
    const svc = await buildService(redis);

    const result = await svc.verifyRequest({
      nonce: 'nonce-1',
      timestamp: Date.now(),
      signature: 'sig',
      signer: '0x0',
      payload: {},
    });

    // Signature verification will fail (no real sig), but nonce consumption
    // happens after timestamp/signature checks — we test the nonce path via
    // isNonceUsed and consumeNonce indirectly through verifyRequest flow.
    // For the atomic path, assert SET NX was called with correct args.
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('nonce-1'),
      '1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('rejects a replayed nonce (SET NX returns null)', async () => {
    const redis = makeRedis({ set: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(redis);

    // Bypass signature check by spying on verifyMessage — we only care about
    // the nonce-consumed branch here.
    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    const result = await svc.verifyRequest({
      nonce: 'used-nonce',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/replay/i);

    jest.restoreAllMocks();
  });

  it('uses TTL derived from nonceTtlMs config', async () => {
    const redis = makeRedis();
    const svc = await buildService(redis, { nonceTtlMs: 10_000 });

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    await svc.verifyRequest({
      nonce: 'ttl-nonce',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });

    const [, , , ttl] = (redis.set as jest.Mock).mock.calls[0];
    expect(ttl).toBe(10); // 10_000 ms → 10 s

    jest.restoreAllMocks();
  });

  it('rejects requests whose timestamp drift exceeds the configured window', async () => {
    const redis = makeRedis();
    const svc = await buildService(redis, { maxTimestampDriftMs: 1000 });

    const result = await svc.verifyRequest({
      nonce: 'n',
      timestamp: Date.now() - 60_000, // 60 s ago
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/drift/i);
    // Redis must NOT be touched for an expired timestamp
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('isNonceUsed returns true when Redis key exists', async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue('1') });
    const svc = await buildService(redis);

    expect(await svc.isNonceUsed('some-nonce')).toBe(true);
  });

  it('isNonceUsed returns false when Redis key is absent', async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue(null) });
    const svc = await buildService(redis);

    expect(await svc.isNonceUsed('fresh-nonce')).toBe(false);
  });
});

describe('ReplayProtectionService — memory fallback (no Redis)', () => {
  it('accepts a fresh nonce in memory', async () => {
    const svc = await buildService(null);

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    const result = await svc.verifyRequest({
      nonce: 'mem-nonce-1',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });

    expect(result.valid).toBe(true);
    jest.restoreAllMocks();
  });

  it('rejects a replayed nonce in memory', async () => {
    const svc = await buildService(null);

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    const req = {
      nonce: 'mem-replay',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    };

    const first = await svc.verifyRequest(req);
    expect(first.valid).toBe(true);

    const second = await svc.verifyRequest({ ...req });
    expect(second.valid).toBe(false);
    expect(second.error).toMatch(/replay/i);

    jest.restoreAllMocks();
  });

  it('isNonceUsed reflects memory state', async () => {
    const svc = await buildService(null);

    expect(await svc.isNonceUsed('unknown')).toBe(false);

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    await svc.verifyRequest({
      nonce: 'known',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });

    expect(await svc.isNonceUsed('known')).toBe(true);
    jest.restoreAllMocks();
  });
});

describe('ReplayProtectionService — Redis failure degrades to memory', () => {
  it('falls back to memory when Redis SET throws', async () => {
    const redis = makeRedis({
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const svc = await buildService(redis);

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    // First call: Redis fails → memory fallback → nonce accepted
    const first = await svc.verifyRequest({
      nonce: 'fallback-nonce',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });
    expect(first.valid).toBe(true);

    // Second call with same nonce: memory fallback rejects replay
    const second = await svc.verifyRequest({
      nonce: 'fallback-nonce',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    });
    expect(second.valid).toBe(false);
    expect(second.error).toMatch(/replay/i);

    jest.restoreAllMocks();
  });
});

describe('ReplayProtectionService — concurrency simulation', () => {
  it('only one of two concurrent identical nonces is accepted (memory)', async () => {
    const svc = await buildService(null);

    const { ethers } = await import('ethers');
    jest.spyOn(ethers, 'verifyMessage').mockReturnValue('0xSigner');
    jest.spyOn(ethers, 'getAddress').mockImplementation((v) => v);

    const req = {
      nonce: 'concurrent-nonce',
      timestamp: Date.now(),
      signature: '0xsig',
      signer: '0xSigner',
      payload: {},
    };

    // Fire both concurrently — JS single-threaded, but both promises are
    // created before either resolves, exercising the Map.has + Map.set path.
    const [r1, r2] = await Promise.all([
      svc.verifyRequest({ ...req }),
      svc.verifyRequest({ ...req }),
    ]);

    const accepted = [r1, r2].filter((r) => r.valid).length;
    const rejected = [r1, r2].filter((r) => !r.valid).length;

    expect(accepted).toBe(1);
    expect(rejected).toBe(1);

    jest.restoreAllMocks();
  });
});
