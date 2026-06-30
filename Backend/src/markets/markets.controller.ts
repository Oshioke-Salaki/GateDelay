import { Controller, Get } from '@nestjs/common';
import { MarketResolverService } from './market-resolver.service';

// Use the existing CommonJS tradeAggregator for real-time stats
const tradeAggregator = require('../../services/tradeAggregator');

@Controller('api/markets')
export class MarketsController {
  constructor(private readonly marketResolver: MarketResolverService) {}

  @Get()
  async list() {
    const markets = this.marketResolver.getAllMarkets();

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
          asset: m.title && m.title.includes('-') ? m.title.split('-')[0] : m.title,
          price: parseFloat(stats.lastPrice || '0') || 0,
          feePercent: 0, // placeholder — augment from orderbook/provider if available
          liquidity: parseFloat(stats.volume || '0') || 0,
        };
      }),
    );

    return { success: true, data };
  }
}
