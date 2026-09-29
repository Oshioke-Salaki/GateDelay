import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { SorobanNftClient } from './soroban/soroban-nft.client';
import { RoyaltyQueryResponseDto } from './dto/royalty.dto';

const ROYALTY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const royaltyCacheKey = (mintAddress: string) => `nft:royalty:${mintAddress}`;

@Injectable()
export class NftService {
  private readonly logger = new Logger(NftService.name);

  constructor(
    private readonly soroban: SorobanNftClient,
    private readonly cache: CacheService,
  ) {}

  async getOnChainRoyalty(
    mintAddress: string,
  ): Promise<RoyaltyQueryResponseDto> {
    const key = royaltyCacheKey(mintAddress);
    const cached =
      await this.cache.get<Omit<RoyaltyQueryResponseDto, 'cached'>>(key);

    if (cached) {
      this.logger.debug(`Royalty cache hit for ${mintAddress}`);
      return { ...cached, cached: true };
    }

    const onChain = await this.soroban.getRoyalties(mintAddress);
    const result: Omit<RoyaltyQueryResponseDto, 'cached'> = {
      mintAddress,
      royaltyBps: onChain.royaltyBps,
      recipient: onChain.recipient,
    };

    await this.cache.set(key, result, ROYALTY_CACHE_TTL_MS);
    this.logger.log(`Queried on-chain royalty for ${mintAddress}`);
    return { ...result, cached: false };
  }
}
