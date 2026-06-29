import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NonceManagerService } from './nonce-manager.service';

describe('NonceManagerService', () => {
  let service: NonceManagerService;

  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async <T>(key: string): Promise<T | undefined> => {
      return cacheStore.get(key) as T | undefined;
    }),
    set: jest.fn(async (key: string, value: unknown): Promise<void> => {
      cacheStore.set(key, value);
    }),
  };

  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'BLOCKCHAIN_RPC_URL') return 'https://rpc.test';
      return fallback;
    }),
  };

  const mockProvider = {
    getTransactionCount: jest.fn(async () => 10),
  };

  const testAddress = ethers.Wallet.createRandom().address;

  beforeEach(async () => {
    cacheStore.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NonceManagerService,
        { provide: ConfigService, useValue: config },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<NonceManagerService>(NonceManagerService);
    (service as unknown as { providerCache: Map<string, unknown> }).providerCache.set(
      'mantle',
      mockProvider,
    );
  });

  it('reserves nonces sequentially and avoids conflicts', async () => {
    const r1 = await service.reserveNonce(testAddress, 'mantle', 60_000);
    const r2 = await service.reserveNonce(testAddress, 'mantle', 60_000);

    expect(r1.nonce).toBe(10);
    expect(r2.nonce).toBe(11);
    expect(r1.reservationId).not.toBe(r2.reservationId);
  });

  it('commits reservation and does not reuse committed nonce', async () => {
    const r1 = await service.reserveNonce(testAddress, 'mantle', 60_000);
    await service.commitReservation(testAddress, r1.reservationId, 'mantle');

    const r2 = await service.reserveNonce(testAddress, 'mantle', 60_000);
    expect(r2.nonce).toBe(11);
  });

  it('fills nonce gaps and can reserve first gap', async () => {
    const r1 = await service.reserveNonce(testAddress, 'mantle', 60_000);
    const r2 = await service.reserveNonce(testAddress, 'mantle', 60_000);
    const r3 = await service.reserveNonce(testAddress, 'mantle', 60_000);

    await service.commitReservation(testAddress, r1.reservationId, 'mantle');
    await service.commitReservation(testAddress, r3.reservationId, 'mantle');
    await service.releaseReservation(testAddress, r2.reservationId, 'mantle');

    const result = await service.fillNonceGaps(testAddress, 'mantle', true, 60_000);

    expect(result.reserved).toBeDefined();
    expect(result.reserved?.nonce).toBe(11);
    expect(result.gaps).not.toContain(11);
  });

  it('syncs nonce with chain pending count', async () => {
    await service.reserveNonce(testAddress, 'mantle', 60_000);

    mockProvider.getTransactionCount.mockResolvedValueOnce(20);
    const synced = await service.syncNonce(testAddress, 'mantle');

    expect(synced.chainNonce).toBe(20);
    expect(synced.nextNonce).toBe(20);
  });
});
