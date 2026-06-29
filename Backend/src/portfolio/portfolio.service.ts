import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PositionsService } from '../positions/positions.service';

export interface PortfolioSnapshot {
  timestamp: Date;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
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
    const result = this._calculate(userId);
    await this.cache.set(cacheKey, result, 30_000);
    return result;
  }

  getHistory(userId: string): PortfolioSnapshot[] {
    return this.history.get(userId) ?? [];
  }

  recordSnapshot(userId: string): void {
    const { totalCost, totalPnl, totalPnlPct } = this._calculate(userId);
    const snapshots = this.history.get(userId) ?? [];
    snapshots.push({ timestamp: new Date(), totalCost, totalPnl, totalPnlPct });
    this.history.set(userId, snapshots);
  }

  private _calculate(userId: string) {
    const positions = this.positionsService.getUserPositions(userId);
    const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const byMarket = positions.reduce<
      Record<string, { pnl: number; positions: number }>
    >((acc, p) => {
      if (!acc[p.marketId]) acc[p.marketId] = { pnl: 0, positions: 0 };
      acc[p.marketId].pnl += p.pnl;
      acc[p.marketId].positions += 1;
      return acc;
    }, {});
    return {
      totalCost,
      totalPnl,
      totalPnlPct,
      openCount: positions.filter((p) => p.status === 'open').length,
      closedCount: positions.filter((p) => p.status === 'closed').length,
      byMarket,
    };
  }
}
