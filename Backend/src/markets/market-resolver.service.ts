import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createRequire } from 'module';
import { paginate } from '../../utils/pagination';
import type { PaginationMeta } from '../../utils/pagination';
import { CacheRefreshService } from '../cache/cache-refresh.service';

// The durable audit trail lives in the CommonJS half of the package
// (services/auditTrail.js → the `audit_logs` collection). market-audit.module.ts
// bridges to it the same way. Writes are fire-and-forget on purpose: an audit
// failure must not abort a resolution, and the helper already swallows and logs
// its own errors.
const nodeRequire = createRequire(__filename);
const auditTrail = nodeRequire('../../services/auditTrail') as {
  logMarketCreated(params: {
    marketId: string;
    actor?: string;
    market: unknown;
    categoryId?: string;
  }): Promise<unknown>;
  logMarketResolved(params: {
    marketId: string;
    actor?: string;
    outcome: string;
    totalPayout: bigint;
    resolvedAt: Date;
  }): Promise<unknown>;
  logMarketResolutionFailed(params: {
    marketId: string;
    actor?: string;
    error: string;
  }): Promise<unknown>;
};

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

  constructor(private readonly cacheRefresh: CacheRefreshService) {}

  // ─── Public management helpers ──────────────────────────────────────────────

  /**
   * Register a market and record the creation in the audit trail (#914).
   *
   * The registry is in-memory, so a restart silently drops every market — which
   * is precisely why the opening terms have to survive somewhere durable.
   * `changes.after` in the audit entry holds the definition that was accepted.
   *
   * @param market - The market to register.
   * @param actor - Optional creator identifier for the audit entry.
   */
  registerMarket(market: Market, actor?: string): void {
    this.markets.set(market.id, { ...market });
    this.logger.log(
      `Market registered: ${market.id} — deadline ${market.deadline.toISOString()}`,
    );
    void auditTrail.logMarketCreated({
      marketId: market.id,
      actor,
      categoryId: market.categoryId,
      // bigint does not survive JSON.stringify, so record the stakes as strings.
      market: {
        id: market.id,
        title: market.title,
        deadline: market.deadline,
        status: market.status,
        totalYesStake: market.totalYesStake.toString(),
        totalNoStake: market.totalNoStake.toString(),
        categoryId: market.categoryId,
      },
    });
    void this.cacheRefresh.refresh({
      type: 'market.updated',
      marketId: market.id,
    });
  }

  /**
   * Apply an edit to a registered market's terms or stakes.
   *
   * Status, outcome and category have dedicated paths (`resolveMarket`,
   * `CategoriesService.assignMarket`) with their own cache refresh events, so
   * they are not patchable here.
   *
   * @returns The updated market, or `undefined` if it is not registered.
   */
  updateMarket(
    marketId: string,
    changes: Partial<
      Pick<Market, 'title' | 'deadline' | 'totalYesStake' | 'totalNoStake'>
    >,
  ): Market | undefined {
    const market = this.markets.get(marketId);
    if (!market) return undefined;
    Object.assign(market, changes);
    void this.cacheRefresh.refresh({ type: 'market.updated', marketId });
    return market;
  }

  getMarket(id: string): Market | undefined {
    return this.markets.get(id);
  }

  getAllMarkets(): Market[] {
    return Array.from(this.markets.values());
  }

  /**
   * Page through the registry with pagination metadata (#916).
   *
   * The registry is an in-memory `Map`, so this slices rather than pushing a
   * skip/limit into a query; the returned `meta` is the same shape the
   * Mongo-backed lists produce, so a client can page all four resource types
   * with one code path.
   *
   * @param options - `page` / `limit`; both are clamped by `normalizePagination`.
   */
  getMarketsPage(options: { page?: number; limit?: number } = {}): {
    markets: Market[];
    meta: PaginationMeta;
  } {
    const { items, meta } = paginate(this.getAllMarkets(), options);
    return { markets: items, meta };
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

  /**
   * Resolve a market to a terminal state, recording both outcomes in the audit
   * trail (#914).
   *
   * The failure branch is the important one: it silently resets the market to
   * `active` so the cron retries, and without an audit entry that state change
   * is invisible to anyone reviewing why a market has been "active past its
   * deadline" for hours.
   *
   * @param marketId - Market to resolve.
   * @param actor - Optional resolver identifier for the audit entry.
   */
  async resolveMarket(
    marketId: string,
    actor?: string,
  ): Promise<ResolutionEvent | null> {
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
      // Local, so the audit entry below gets a `Date` rather than
      // `Date | undefined` — `resolvedAt` is optional on the interface and
      // strictNullChecks is on.
      const resolvedAt = new Date();
      market.resolvedAt = resolvedAt;

      const event: ResolutionEvent = {
        marketId,
        outcome,
        totalPayout,
        resolvedAt,
        auditLog,
      };
      this.resolutionHistory.push(event);

      this.logger.log(
        `Market ${marketId} resolved → ${outcome}. Total payout: ${totalPayout.toString()} wei`,
      );

      await this.cacheRefresh.refresh({ type: 'market.resolved', marketId });

      await auditTrail.logMarketResolved({
        marketId,
        actor,
        outcome,
        totalPayout,
        resolvedAt,
      });

      return event;
    } catch (err) {
      market.status = 'active'; // rollback so scheduler retries
      this.logger.error(`Failed to resolve market ${marketId}`, err);
      await auditTrail.logMarketResolutionFailed({
        marketId,
        actor,
        error: err instanceof Error ? err.message : String(err),
      });
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
