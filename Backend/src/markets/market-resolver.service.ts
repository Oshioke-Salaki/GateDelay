import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { createRequire } from 'module';
import { paginate } from '../../utils/pagination';
import type { PaginationMeta } from '../../utils/pagination';
import { CacheRefreshService } from '../cache/cache-refresh.service';
import { MarketRecord } from './schemas/market.schema';
import type { MarketDocument } from './schemas/market.schema';

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
  description?: string;
  deadline: Date;
  totalYesStake: bigint; // in wei
  totalNoStake: bigint; // in wei
  status: MarketStatus;
  outcome?: MarketOutcome;
  resolvedAt?: Date;
  oracleData?: unknown;
  categoryId?: string;
  chainId?: number;
  factoryAddress?: string;
  factoryAbiVersion?: string;
  marketAddress?: string;
  creator?: string;
  collateralToken?: string;
  minLiquidity?: string;
  metadataURI?: string;
  creationBlockNumber?: number;
  creationTransactionHash?: string;
  creationLogIndex?: number;
}

export interface ResolutionEvent {
  marketId: string;
  outcome: MarketOutcome;
  totalPayout: bigint;
  resolvedAt: Date;
  auditLog: string[];
}

@Injectable()
export class MarketResolverService implements OnModuleInit {
  private readonly logger = new Logger(MarketResolverService.name);

  /** Local read cache; MongoDB is the shared source of truth. */
  private readonly markets = new Map<string, Market>();
  private readonly resolutionHistory: ResolutionEvent[] = [];

  constructor(
    @InjectModel(MarketRecord.name)
    private readonly marketModel: Model<MarketDocument>,
    private readonly cacheRefresh: CacheRefreshService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.marketModel.createIndexes();
    await this.loadMarkets();
  }

  private async loadMarkets(): Promise<Market[]> {
    const records = await this.marketModel
      .find()
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();
    const markets = records.map((record) => this.deserializeMarket(record));
    this.markets.clear();
    for (const market of markets) {
      this.markets.set(market.id, market);
    }
    return markets;
  }

  private deserializeMarket(
    record: Pick<
      MarketRecord,
      | 'id'
      | 'title'
      | 'description'
      | 'deadline'
      | 'totalYesStake'
      | 'totalNoStake'
      | 'status'
      | 'outcome'
      | 'resolvedAt'
      | 'oracleData'
      | 'categoryId'
      | 'chainId'
      | 'factoryAddress'
      | 'factoryAbiVersion'
      | 'marketAddress'
      | 'creator'
      | 'collateralToken'
      | 'minLiquidity'
      | 'metadataURI'
      | 'creationBlockNumber'
      | 'creationTransactionHash'
      | 'creationLogIndex'
    >,
  ): Market {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      deadline: new Date(record.deadline),
      totalYesStake: BigInt(record.totalYesStake),
      totalNoStake: BigInt(record.totalNoStake),
      status: record.status,
      outcome: record.outcome,
      resolvedAt: record.resolvedAt ? new Date(record.resolvedAt) : undefined,
      oracleData: record.oracleData,
      categoryId: record.categoryId,
      chainId: record.chainId,
      factoryAddress: record.factoryAddress,
      factoryAbiVersion: record.factoryAbiVersion,
      marketAddress: record.marketAddress,
      creator: record.creator,
      collateralToken: record.collateralToken,
      minLiquidity: record.minLiquidity,
      metadataURI: record.metadataURI,
      creationBlockNumber: record.creationBlockNumber,
      creationTransactionHash: record.creationTransactionHash,
      creationLogIndex: record.creationLogIndex,
    };
  }

  private serializeMarket(market: Market) {
    return {
      id: market.id,
      title: market.title,
      description: market.description,
      deadline: market.deadline,
      totalYesStake: market.totalYesStake.toString(),
      totalNoStake: market.totalNoStake.toString(),
      status: market.status,
      outcome: market.outcome,
      resolvedAt: market.resolvedAt,
      oracleData: market.oracleData,
      categoryId: market.categoryId,
      chainId: market.chainId,
      factoryAddress: market.factoryAddress,
      factoryAbiVersion: market.factoryAbiVersion,
      marketAddress: market.marketAddress,
      creator: market.creator,
      collateralToken: market.collateralToken,
      minLiquidity: market.minLiquidity,
      metadataURI: market.metadataURI,
      creationBlockNumber: market.creationBlockNumber,
      creationTransactionHash: market.creationTransactionHash,
      creationLogIndex: market.creationLogIndex,
    };
  }

  private async persistMarket(market: Market): Promise<void> {
    const set: Record<string, unknown> = this.serializeMarket(market);
    const unset: Record<string, 1> = {};
    if (market.outcome === undefined) {
      unset.outcome = 1;
      delete set.outcome;
    }
    if (market.resolvedAt === undefined) {
      unset.resolvedAt = 1;
      delete set.resolvedAt;
    }
    if (market.oracleData === undefined) {
      unset.oracleData = 1;
      delete set.oracleData;
    }
    if (market.categoryId === undefined) {
      unset.categoryId = 1;
      delete set.categoryId;
    }

    await this.marketModel
      .updateOne(
        { id: market.id },
        {
          $set: set,
          ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
        },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  // ─── Public management helpers ──────────────────────────────────────────────

  /**
   * Register a market and record the creation in the audit trail (#914).
   *
   * Persist the market before acknowledging registration so retries cannot
   * report success for a record that would be lost on restart.
   *
   * @param market - The market to register.
   * @param actor - Optional creator identifier for the audit entry.
   */
  async registerMarket(market: Market, actor?: string): Promise<void> {
    await this.persistMarket(market);
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

  async registerDiscoveredMarket(market: Market): Promise<boolean> {
    const result = await this.marketModel
      .updateOne(
        { id: market.id },
        { $setOnInsert: this.serializeMarket(market) },
        { upsert: true, runValidators: true },
      )
      .exec();
    await this.getMarket(market.id);
    if (result.upsertedCount > 0) {
      this.logger.log(`Market discovered from factory event: ${market.id}`);
      void this.cacheRefresh.refresh({
        type: 'market.updated',
        marketId: market.id,
      });
      return true;
    }
    return false;
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
  async updateMarket(
    marketId: string,
    changes: Partial<
      Pick<Market, 'title' | 'deadline' | 'totalYesStake' | 'totalNoStake'>
    >,
  ): Promise<Market | undefined> {
    const market = await this.getMarket(marketId);
    if (!market) return undefined;
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      update[key] = typeof value === 'bigint' ? value.toString() : value;
    }
    const result = await this.marketModel
      .updateOne({ id: market.id }, { $set: update })
      .exec();
    if (result.matchedCount === 0) {
      this.markets.delete(market.id);
      return undefined;
    }
    const updatedMarket = await this.getMarket(market.id);
    void this.cacheRefresh.refresh({ type: 'market.updated', marketId: market.id });
    return updatedMarket;
  }

  async getMarket(id: string): Promise<Market | undefined> {
    const marketId = /^0x[0-9a-f]{40}$/i.test(id) ? id.toLowerCase() : id;
    const record = await this.marketModel.findOne({ id: marketId }).lean().exec();
    if (!record) {
      this.markets.delete(marketId);
      return undefined;
    }
    const market = this.deserializeMarket(record);
    this.markets.set(marketId, market);
    return market;
  }

  async getAllMarkets(): Promise<Market[]> {
    return this.loadMarkets();
  }

  /**
   * Page through persisted markets with pagination metadata (#916).
   *
   * The market catalog is loaded from MongoDB before pagination; the returned
   * `meta` matches the other resource list endpoints.
   *
   * @param options - `page` / `limit`; both are clamped by `normalizePagination`.
   */
  async getMarketsPage(options: { page?: number; limit?: number } = {}): Promise<{
    markets: Market[];
    meta: PaginationMeta;
  }> {
    const { items, meta } = paginate(await this.getAllMarkets(), options);
    return { markets: items, meta };
  }

  async getMarketsByIds(ids: string[]): Promise<Market[]> {
    if (ids.length === 0) return [];
    const marketIds = ids.map((id) =>
      /^0x[0-9a-f]{40}$/i.test(id) ? id.toLowerCase() : id,
    );
    const records = await this.marketModel
      .find({ id: { $in: marketIds } })
      .lean()
      .exec();
    const markets = records.map((record) => this.deserializeMarket(record));
    for (const market of markets) {
      this.markets.set(market.id, market);
    }
    const byId = new Map(markets.map((market) => [market.id, market]));
    return marketIds.map((id) => byId.get(id)).filter((m): m is Market => !!m);
  }

  async updateMarketCategory(marketId: string, categoryId: string): Promise<void> {
    const market = await this.getMarket(marketId);
    if (!market) return;
    const result = await this.marketModel
      .updateOne({ id: market.id }, { $set: { categoryId } })
      .exec();
    if (result.matchedCount > 0) {
      await this.getMarket(market.id);
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
    const expired = (await this.getAllMarkets()).filter(
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
    const market = await this.getMarket(marketId);
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

    const claim = await this.marketModel
      .updateOne(
        { id: market.id, status: 'active' },
        { $set: { status: 'resolving' } },
      )
      .exec();
    if (claim.matchedCount === 0) {
      this.logger.warn(
        `resolveMarket: market ${marketId} was claimed by another instance`,
      );
      return null;
    }

    market.status = 'resolving';
    this.markets.set(market.id, market);
    const auditLog: string[] = [];
    let outcome: MarketOutcome;
    let totalPayout: bigint;
    let resolvedAt: Date;
    try {
      // 1. Fetch oracle data
      auditLog.push(
        `[${new Date().toISOString()}] Fetching oracle data for market ${marketId}`,
      );
      const oracleData = await this.fetchOracleData(market);
      market.oracleData = oracleData;
      auditLog.push(`[${new Date().toISOString()}] Oracle data received`);

      // 2. Determine outcome
      outcome = this.calculateOutcome(market, oracleData);
      auditLog.push(
        `[${new Date().toISOString()}] Outcome calculated: ${outcome}`,
      );

      // 3. Calculate payouts
      totalPayout = this.calculatePayouts(market, outcome, auditLog);
      resolvedAt = new Date();

      // 4. Finalise market
      const saved = await this.marketModel
        .updateOne(
          { id: market.id, status: 'resolving' },
          {
            $set: {
              status: 'resolved',
              outcome,
              resolvedAt,
              oracleData: market.oracleData,
            },
          },
        )
        .exec();
      if (saved.matchedCount === 0) {
        throw new Error(`Market ${marketId} changed while resolution was running`);
      }
    } catch (err) {
      const rollback = await this.marketModel
        .updateOne(
          { id: market.id, status: 'resolving' },
          { $set: { status: 'active', oracleData: market.oracleData } },
        )
        .exec();
      if (rollback.matchedCount > 0) {
        market.status = 'active';
        this.markets.set(market.id, market);
      }
      this.logger.error(`Failed to resolve market ${marketId}`, err);
      await auditTrail.logMarketResolutionFailed({
        marketId,
        actor,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }

    market.status = 'resolved';
    market.outcome = outcome;
    market.resolvedAt = resolvedAt;
    this.markets.set(market.id, market);

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
