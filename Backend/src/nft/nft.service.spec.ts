import { NotFoundException } from '@nestjs/common';
import { NftService } from './nft.service';
import { SorobanNftClient } from './soroban/soroban-nft.client';
import { CacheService } from '../cache/cache.service';

describe('NftService', () => {
  let service: NftService;
  let soroban: jest.Mocked<Pick<SorobanNftClient, 'getRoyalties'>>;
  let cache: jest.Mocked<Pick<CacheService, 'get' | 'set'>>;

  beforeEach(() => {
    soroban = {
      getRoyalties: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new NftService(
      soroban as unknown as SorobanNftClient,
      cache as unknown as CacheService,
    );
  });

  it('queries Soroban and caches royalty results', async () => {
    cache.get.mockResolvedValue(null);
    soroban.getRoyalties.mockResolvedValue({
      royaltyBps: 1000,
      recipient: 'GABC',
    });

    const result = await service.getOnChainRoyalty('CMINT1');

    expect(result).toEqual({
      mintAddress: 'CMINT1',
      royaltyBps: 1000,
      recipient: 'GABC',
      cached: false,
    });
    expect(cache.set).toHaveBeenCalledWith(
      'nft:royalty:CMINT1',
      {
        mintAddress: 'CMINT1',
        royaltyBps: 1000,
        recipient: 'GABC',
      },
      5 * 60 * 1000,
    );
  });

  it('returns cached royalty without hitting Soroban', async () => {
    cache.get.mockResolvedValue({
      mintAddress: 'CMINT1',
      royaltyBps: 500,
      recipient: 'GXYZ',
    });

    const result = await service.getOnChainRoyalty('CMINT1');

    expect(result.cached).toBe(true);
    expect(result.royaltyBps).toBe(500);
    expect(soroban.getRoyalties).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from Soroban client', async () => {
    cache.get.mockResolvedValue(null);
    soroban.getRoyalties.mockRejectedValue(
      new NotFoundException('Royalty data not found for mint address missing'),
    );

    await expect(service.getOnChainRoyalty('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
