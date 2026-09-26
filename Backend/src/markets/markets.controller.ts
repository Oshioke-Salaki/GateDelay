import { Controller, Get, Query } from '@nestjs/common';
import { createRequire } from 'module';
import { MarketResolverService } from './market-resolver.service';
import { ListMarketsQueryDto } from './dto/list-markets.dto';
import { CacheService } from '../cache/cache.service';
import { CacheKeys, CacheTtl } from '../cache/cache-refresh.policy';

// Use the existing CommonJS tradeAggregator for real-time stats
const nodeRequire = createRequire(__filename);
const tradeAggregator = nodeRequire('../../services/tradeAggregator') as {
  getMarketStats?: (marketId: string) => Promise<Record<string, unknown>>;
  getRealTimeStats: (marketId: string) => Promise<Record<string, unknown>>;
};

@Controller('api/markets')
export class MarketsController {
  constructor(
    private readonly marketResolver: MarketResolverService,
    private readonly cache: CacheService,
  ) {}

  /**
   * GET /markets — paginated market list.
   *
   * `page` / `limit` come in through `ListMarketsQueryDto`; the registry is
   * sliced in memory, and the response carries the standard `meta` block so
   * markets, trades, audit logs and notifications page identically (#916).
   *
   * Pages are cached briefly and evicted on `market.updated` /
   * `market.resolved` (see cache-refresh.policy.ts).
   */
  @Get()
  async list(@Query() query: ListMarketsQueryDto) {
    const { meta } = this.marketResolver.getMarketsPage(query);
    return this.cache.getOrSet(
      CacheKeys.marketsList(meta.page, meta.limit),
      () => this.buildPage(query),
      CacheTtl.marketsList,
    );
  }

  private async buildPage(query: ListMarketsQueryDto) {
    const { markets, meta } = this.marketResolver.getMarketsPage(query);

    const data = await Promise.all(
      markets.map(async (m) => {
        // try to fetch real-time stats by market title (e.g. 'ETH-USDT')
        let stats = {} as any;
        try {
          stats = await tradeAggregator.getRealTimeStats(m.title || m.id);
        } catch (e) {
          stats = {};
        }

        return {
          id: m.id,
          name: m.title,
          asset:
            m.title && m.title.includes('-') ? m.title.split('-')[0] : m.title,
          price: parseFloat(stats.lastPrice || '0') || 0,
          feePercent: 0, // placeholder — augment from orderbook/provider if available
          liquidity: parseFloat(stats.volume || '0') || 0,
        };
      }),
    );

    return { success: true, data, meta };
  }
}
