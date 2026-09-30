import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

const normalizeArchiveOutcome = (value?: string): 'yes' | 'no' | 'cancelled' => {
  if (!value) return 'cancelled';
  const normalized = value.toLowerCase();
  if (normalized === 'yes') return 'yes';
  if (normalized === 'no') return 'no';
  return 'cancelled';
};

@ApiTags('markets')
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

  @Get('archive')
  @ApiOperation({
    summary: 'List archived markets',
    description:
      'Returns resolved or cancelled markets in the archive format consumed by the frontend archive page.',
  })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'outcome', required: false, type: String, enum: ['yes', 'no', 'cancelled'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Archived market list' })
  getArchive(@Query() query: Record<string, unknown> = {}) {
    const category =
      typeof query.category === 'string' ? query.category.trim().toLowerCase() : undefined;
    const outcome =
      typeof query.outcome === 'string'
        ? normalizeArchiveOutcome(query.outcome)
        : undefined;

    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit ?? 50) || 50));

    const fromMs =
      typeof query.from === 'string' && query.from ? Date.parse(query.from) : undefined;
    const toMs =
      typeof query.to === 'string' && query.to ? Date.parse(query.to) : undefined;

    const archived = this.marketResolver
      .getAllMarkets()
      .filter((market) => !!market)
      .filter((market) => market.status === 'resolved' || market.status === 'cancelled')
      .filter((market) => {
        if (category && (market.categoryId ?? '').toLowerCase() !== category) return false;
        if (outcome === 'cancelled') {
          if (market.status !== 'cancelled') return false;
        } else if (market.status !== 'resolved') {
          return false;
        }
        if (outcome && outcome !== 'cancelled') {
          const outcomeValue = market.outcome?.toString().toLowerCase();
          if (outcomeValue !== outcome) return false;
        }
        const resolutionTimestamp = market.resolvedAt?.getTime() ?? market.deadline.getTime();
        if (fromMs !== undefined && resolutionTimestamp < fromMs) return false;
        if (toMs !== undefined && resolutionTimestamp > toMs) return false;
        return true;
      })
      .map((market) => ({
        id: market.id,
        title: market.title || market.id,
        description: market.title || 'Archived market',
        category: market.categoryId || 'general',
        resolvedOutcome: market.status === 'cancelled' ? 'cancelled' : normalizeArchiveOutcome(market.outcome?.toString()),
        resolutionDate: (market.resolvedAt ?? market.deadline).toISOString(),
        volume: Number((market.totalYesStake ?? 0n) + (market.totalNoStake ?? 0n)),
        participants: 0,
        createdAt: new Date(market.deadline).toISOString(),
        endDate: new Date(market.deadline).toISOString(),
        finalPrice: 0,
      }))
      .sort(
        (left, right) =>
          new Date(left.resolutionDate).getTime() -
          new Date(right.resolutionDate).getTime(),
      );

    const total = archived.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageIndex = Math.min(page, totalPages);
    const start = (pageIndex - 1) * limit;
    const data = archived.slice(start, start + limit);

    return {
      success: true,
      data,
      meta: {
        page: pageIndex,
        limit,
        total,
        totalPages,
      },
    };
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
