import Big from 'big.js';
import { Injectable } from '@nestjs/common';
import { PositionsService } from '../positions/positions.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys, CacheTtl } from '../cache/cache-refresh.policy';

export interface PortfolioSnapshot {
  timestamp: Date;
  totalCost: string;
  totalPnl: string;
  totalPnlPct: string;
}

@Injectable()
export class PortfolioService {
  private readonly history = new Map<string, PortfolioSnapshot[]>();

  constructor(
    private readonly positionsService: PositionsService,
    private readonly cache: CacheService,
  ) {}

  async getPortfolio(userId: string) {
    const key = CacheKeys.portfolio(userId);
    const cached = await this.cache.get<ReturnType<typeof this._calculate>>(key);
    if (cached !== null) return cached;
    const result = await this._calculate(userId);
    await this.cache.set(key, result, CacheTtl.portfolio);
    return result;
  }

  /** Evict the cached portfolio for a user after any position change. */
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(CacheKeys.portfolio(userId));
  }

  getHistory(userId: string): PortfolioSnapshot[] {
    return this.history.get(userId) ?? [];
  }

  async recordSnapshot(userId: string): Promise<void> {
    const { totalCost, totalPnl, totalPnlPct } = await this._calculate(userId);
    const snapshots = this.history.get(userId) ?? [];
    snapshots.push({ timestamp: new Date(), totalCost, totalPnl, totalPnlPct });
    this.history.set(userId, snapshots);
  }

  private async _calculate(userId: string) {
    const positions = await this.positionsService.getUserPositions(userId);
    const totalCost = positions.reduce((s, p) => s.plus(p.costBasis), new Big(0));
    const totalPnl = positions.reduce((s, p) => s.plus(p.pnl).plus(p.realizedPnl), new Big(0));
    const totalPnlPct = totalCost.gt(0) ? totalPnl.div(totalCost).times(100).toFixed(8, Big.roundHalfUp) : '0';
    const byMarket = positions.reduce<Record<string, { pnl: string; positions: number }>>((acc, p) => {
      if (!acc[p.marketId]) acc[p.marketId] = { pnl: '0', positions: 0 };
      acc[p.marketId].pnl = new Big(acc[p.marketId].pnl).plus(p.pnl).plus(p.realizedPnl).toFixed(18, Big.roundHalfUp);
      acc[p.marketId].positions += 1;
      return acc;
    }, {});
    return {
      totalCost: totalCost.toFixed(18, Big.roundHalfUp),
      totalPnl: totalPnl.toFixed(18, Big.roundHalfUp),
      totalPnlPct,
      openCount: positions.filter((p) => p.status === 'open').length,
      closedCount: positions.filter((p) => p.status === 'closed').length,
      byMarket,
    };
  }
}
