import Big from 'big.js';
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PositionsService } from '../positions/positions.service';

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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getPortfolio(userId: string) {
    const cacheKey = `portfolio:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const result = await this._calculate(userId);
    await this.cache.set(cacheKey, result, 30_000);
    return result;
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
