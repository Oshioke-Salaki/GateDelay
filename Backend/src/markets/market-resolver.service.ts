import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

export type MarketStatus = 'active' | 'resolving' | 'resolved' | 'cancelled';
export type MarketOutcome = 'YES' | 'NO' | 'VOID';

export interface Market {
  id: string;
  title: string;
  deadline: Date;
  totalYesStake: bigint; // in wei
  totalNoStake: bigint; // in wei
  status: MarketStatus;
  outcome?: MarketOutcome;
  resolvedAt?: Date;
  oracleData?: unknown;
  categoryId?: string;
}

export interface ResolutionEvent {
  marketId: string;
  outcome: MarketOutcome;
  totalPayout: bigint;
  resolvedAt: Date;
  auditLog: string[];
}

@Injectable()
export class MarketResolverService {
  private readonly logger = new Logger(MarketResolverService.name);

  /** In-memory registry — swap for a DB repository in production */
  private readonly markets = new Map<string, Market>();
  private readonly resolutionHistory: ResolutionEvent[] = [];

  // ─── Public management helpers ──────────────────────────────────────────────

  registerMarket(market: Market): void {
    this.markets.set(market.id, { ...market });
    this.logger.log(
      `Market registered: ${market.id} — deadline ${market.deadline.toISOString()}`,
    );
  }

  getMarket(id: string): Market | undefined {
    return this.markets.get(id);
  }

  getAllMarkets(): Market[] {
    return Array.from(this.markets.values());
  }

  getMarketsByIds(ids: string[]): Market[] {
    return ids
      .map((id) => this.markets.get(id))
      .filter((m): m is Market => m !== undefined);
  }

  updateMarketCategory(marketId: string, categoryId: string): void {
    const market = this.markets.get(marketId);
    if (market) {
      market.categoryId = categoryId;
    }
  }

  getResolutionHistory(): ResolutionEvent[] {
    return [...this.resolutionHistory];
  }

  // ─── Scheduler ──────────────────────────────────────────────────────────────

  /** Runs every minute. Finds active markets past deadline and resolves them. */
  @Cron('* * * * *')
  async resolveExpiredMarkets(): Promise<void> {
    const now = new Date();
    const expired = Array.from(this.markets.values()).filter(
      (m) => m.status === 'active' && m.deadline <= now,
    );

    if (!expired.length) return;

    this.logger.log(`Scheduler tick: ${expired.length} market(s) to resolve`);
    await Promise.all(expired.map((m) => this.resolveMarket(m.id)));
  }

  // ─── Resolution pipeline ─────────────────────────────────────────────────────

  async resolveMarket(marketId: string): Promise<ResolutionEvent | null> {
    const market = this.markets.get(marketId);
    if (!market) {
      this.logger.warn(`resolveMarket: market ${marketId} not found`);
      return null;
    }
    if (market.status !== 'active') {
      this.logger.warn(
        `resolveMarket: market ${marketId} is already ${market.status}`,
      );
      return null;
    }

    market.status = 'resolving';
    const auditLog: string[] = [];

    try {
      // 1. Fetch oracle data
      auditLog.push(
        `[${new Date().toISOString()}] Fetching oracle data for market ${marketId}`,
      );
      const oracleData = await this.fetchOracleData(market);
      market.oracleData = oracleData;
      auditLog.push(`[${new Date().toISOString()}] Oracle data received`);

      // 2. Determine outcome
      const outcome = this.calculateOutcome(market, oracleData);
      auditLog.push(
        `[${new Date().toISOString()}] Outcome calculated: ${outcome}`,
      );

      // 3. Calculate payouts
      const totalPayout = this.calculatePayouts(market, outcome, auditLog);

      // 4. Finalise market
      market.status = 'resolved';
      market.outcome = outcome;
      market.resolvedAt = new Date();

      const event: ResolutionEvent = {
        marketId,
        outcome,
        totalPayout,
        resolvedAt: market.resolvedAt,
        auditLog,
      };
      this.resolutionHistory.push(event);

      this.logger.log(
        `Market ${marketId} resolved → ${outcome}. Total payout: ${totalPayout.toString()} wei`,
      );
      return event;
    } catch (err) {
      market.status = 'active'; // rollback so scheduler retries
      this.logger.error(`Failed to resolve market ${marketId}`, err);
      return null;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Stub oracle integration. In production replace with an on-chain oracle call
   * (e.g. Chainlink, UMA Optimistic Oracle) or a trusted REST feed.
   */
  private async fetchOracleData(
    market: Market,
  ): Promise<{ onTime: boolean; source: string }> {
    // Deterministic stub: markets with even char count → YES, odd → NO
    const onTime = market.title.length % 2 === 0;
    return { onTime, source: 'stub-oracle' };
  }

  private calculateOutcome(
    _market: Market,
    oracleData: { onTime: boolean; source: string },
  ): MarketOutcome {
    return oracleData.onTime ? 'YES' : 'NO';
  }

  private calculatePayouts(
    market: Market,
    outcome: MarketOutcome,
    auditLog: string[],
  ): bigint {
    const totalPool = market.totalYesStake + market.totalNoStake;

    if (outcome === 'VOID') {
      auditLog.push(
        `VOID outcome — full refund of ${totalPool.toString()} wei`,
      );
      return totalPool;
    }

    const winnerPool =
      outcome === 'YES' ? market.totalYesStake : market.totalNoStake;

    if (winnerPool === 0n) {
      auditLog.push('No winning stakes — pool returned to protocol treasury');
      return totalPool;
    }

    auditLog.push(`Winner pool: ${winnerPool.toString()} wei`);
    auditLog.push(`Total pool (incl. losers): ${totalPool.toString()} wei`);
    auditLog.push(
      'Payout distribution logged — execute on-chain disbursement separately',
    );

    return totalPool;
  }
}
