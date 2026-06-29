import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Cache } from 'cache-manager';
import { create, all } from 'mathjs';
import Web3 from 'web3';
import {
  MarketResolverService,
  Market,
} from '../markets/market-resolver.service';

const math = create(all);
const web3 = new Web3();

const CACHE_TTL = 60_000; // 1 minute
const REPORT_KEY = 'liquidity:report';
const LP_ANALYTICS_KEY = 'liquidity:lp-analytics';
const BASE_REWARD_APY = 0.12;
const BASE_FEE_APY = 0.06;
const AUTOMATION_THRESHOLD = 0.08;

export interface MarketLiquidity {
  marketId: string;
  title: string;
  yesStake: string;
  noStake: string;
  totalLiquidity: string;
  yesRatio: number;
  noRatio: number;
  status: string;
}

export interface LiquidityDepth {
  marketId: string;
  imbalance: number; // |yesRatio - 0.5|, 0 = perfectly balanced
  dominantSide: 'YES' | 'NO' | 'BALANCED';
  depthScore: number; // 0–1, higher = deeper / more balanced
}

export interface LiquidityHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  avgDepthScore: number;
  lowLiquidityMarkets: string[];
  imbalancedMarkets: string[];
}

export interface LiquidityReport {
  generatedAt: string;
  totalMarkets: number;
  activeMarkets: number;
  totalLiquidity: string;
  avgLiquidityPerMarket: string;
  markets: MarketLiquidity[];
  depth: LiquidityDepth[];
  health: LiquidityHealth;
}

export interface LiquidityPoolState {
  marketId: string;
  totalLiquidityEth: number;
  totalShares: number;
  totalFeesDistributedEth: number;
  totalRewardsDistributedEth: number;
  updatedAt: Date;
}

export interface LiquidityPosition {
  userId: string;
  marketId: string;
  walletAddress: string;
  shares: number;
  principalEth: number;
  removedPrincipalEth: number;
  rewardsAccruedEth: number;
  feesAccruedEth: number;
  claimedRewardsEth: number;
  claimedFeesEth: number;
  autoManage: boolean;
  targetYesRatio: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccrualAt: Date;
  automationExecutions: number;
}

export interface LiquidityPositionView {
  marketId: string;
  walletAddress: string;
  shares: number;
  shareRatio: number;
  principalEth: string;
  removedPrincipalEth: string;
  rewardsAccruedEth: string;
  feesAccruedEth: string;
  totalEarnedEth: string;
  estimatedPositionValueEth: string;
  autoManage: boolean;
  targetYesRatio: number;
  createdAt: string;
  updatedAt: string;
  lastAccrualAt: string;
  automationExecutions: number;
}

export interface LiquidityAnalytics {
  generatedAt: string;
  totalProviders: number;
  totalTrackedMarkets: number;
  totalLiquidityEth: string;
  totalPrincipalEth: string;
  totalRewardsEth: string;
  totalFeesEth: string;
  averageEstimatedApy: number;
  topProviders: Array<{
    userId: string;
    estimatedValueEth: string;
    totalEarnedEth: string;
    positions: number;
  }>;
  marketBreakdown: Array<{
    marketId: string;
    providers: number;
    totalLiquidityEth: string;
    totalRewardsEth: string;
    totalFeesEth: string;
    autoManagedProviders: number;
  }>;
}

export interface AutomationExecution {
  marketId: string;
  userId: string;
  action: 'REBALANCED' | 'SKIPPED';
  bonusRewardEth: string;
  deviation: number;
  executedAt: string;
}

const WEI = 1e18;

function weiToEth(wei: bigint): number {
  return Number(wei) / WEI;
}

@Injectable()
export class LiquidityService {
  private readonly logger = new Logger(LiquidityService.name);
  private readonly pools = new Map<string, LiquidityPoolState>();
  private readonly positions = new Map<string, LiquidityPosition>();

  constructor(
    private readonly marketResolver: MarketResolverService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  async getReport(): Promise<LiquidityReport> {
    const cached = await this.cache.get<LiquidityReport>(REPORT_KEY);
    if (cached) return cached;
    return this.buildAndCacheReport();
  }

  async addLiquidity(
    userId: string,
    marketId: string,
    walletAddress: string,
    amountEth: number,
    autoManage?: boolean,
    targetYesRatio?: number,
  ): Promise<LiquidityPositionView> {
    this.assertPositive(amountEth, 'Liquidity amount must be positive');

    const market = this.marketResolver.getMarket(marketId);
    if (!market) throw new NotFoundException('Market not found');

    const normalizedAddress = this.normalizeWallet(walletAddress);
    const key = this.positionKey(userId, marketId);
    const now = new Date();

    const pool = this.ensurePool(market);
    const existing = this.positions.get(key);
    if (existing) this.accruePosition(existing, pool, now);

    const mintedShares =
      pool.totalShares <= 0 || pool.totalLiquidityEth <= 0
        ? amountEth
        : math.number(
            math.round(
              math.divide(
                math.multiply(amountEth, pool.totalShares),
                pool.totalLiquidityEth,
              ),
              12,
            ),
          );

    const position: LiquidityPosition =
      existing ??
      ({
        userId,
        marketId,
        walletAddress: normalizedAddress,
        shares: 0,
        principalEth: 0,
        removedPrincipalEth: 0,
        rewardsAccruedEth: 0,
        feesAccruedEth: 0,
        claimedRewardsEth: 0,
        claimedFeesEth: 0,
        autoManage: autoManage ?? false,
        targetYesRatio: this.normalizeTargetRatio(targetYesRatio),
        createdAt: now,
        updatedAt: now,
        lastAccrualAt: now,
        automationExecutions: 0,
      } as LiquidityPosition);

    if (typeof autoManage === 'boolean') {
      position.autoManage = autoManage;
    }
    if (typeof targetYesRatio === 'number') {
      position.targetYesRatio = this.normalizeTargetRatio(targetYesRatio);
    }

    position.walletAddress = normalizedAddress;
    position.shares = this.round12(position.shares + mintedShares);
    position.principalEth = this.round12(position.principalEth + amountEth);
    position.updatedAt = now;
    position.lastAccrualAt = now;

    pool.totalLiquidityEth = this.round12(pool.totalLiquidityEth + amountEth);
    pool.totalShares = this.round12(pool.totalShares + mintedShares);
    pool.updatedAt = now;

    this.positions.set(key, position);
    await this.invalidateCaches();
    return this.toPositionView(position, pool);
  }

  async removeLiquidity(
    userId: string,
    marketId: string,
    shareAmount: number,
  ): Promise<
    LiquidityPositionView & {
      withdrawnEth: string;
      claimedRewardsEth: string;
      claimedFeesEth: string;
    }
  > {
    this.assertPositive(shareAmount, 'Share amount must be positive');

    const key = this.positionKey(userId, marketId);
    const position = this.positions.get(key);
    if (!position) throw new NotFoundException('Liquidity position not found');

    const pool = this.pools.get(marketId);
    if (!pool || pool.totalShares <= 0 || pool.totalLiquidityEth <= 0) {
      throw new BadRequestException('Liquidity pool has no available liquidity');
    }

    const now = new Date();
    this.accruePosition(position, pool, now);

    if (shareAmount > position.shares) {
      throw new BadRequestException('Insufficient LP shares');
    }

    const withdrawnEth = this.round12(
      math.number(
        math.round(
          math.divide(math.multiply(shareAmount, pool.totalLiquidityEth), pool.totalShares),
          12,
        ),
      ),
    );

    const claimedRewardsEth = this.round12(
      math.number(
        math.round(
          math.divide(math.multiply(position.rewardsAccruedEth, shareAmount), position.shares),
          12,
        ),
      ),
    );
    const claimedFeesEth = this.round12(
      math.number(
        math.round(
          math.divide(math.multiply(position.feesAccruedEth, shareAmount), position.shares),
          12,
        ),
      ),
    );

    position.rewardsAccruedEth = this.round12(
      position.rewardsAccruedEth - claimedRewardsEth,
    );
    position.feesAccruedEth = this.round12(position.feesAccruedEth - claimedFeesEth);
    position.claimedRewardsEth = this.round12(
      position.claimedRewardsEth + claimedRewardsEth,
    );
    position.claimedFeesEth = this.round12(position.claimedFeesEth + claimedFeesEth);

    const principalReduction = this.round12(
      math.number(
        math.round(
          math.divide(math.multiply(position.principalEth, shareAmount), position.shares),
          12,
        ),
      ),
    );
    position.principalEth = this.round12(position.principalEth - principalReduction);
    position.removedPrincipalEth = this.round12(
      position.removedPrincipalEth + principalReduction,
    );
    position.shares = this.round12(position.shares - shareAmount);
    position.updatedAt = now;
    position.lastAccrualAt = now;

    pool.totalLiquidityEth = this.round12(pool.totalLiquidityEth - withdrawnEth);
    pool.totalShares = this.round12(pool.totalShares - shareAmount);
    pool.totalRewardsDistributedEth = this.round12(
      pool.totalRewardsDistributedEth + claimedRewardsEth,
    );
    pool.totalFeesDistributedEth = this.round12(
      pool.totalFeesDistributedEth + claimedFeesEth,
    );
    pool.updatedAt = now;

    if (position.shares <= 0.000000000001) {
      this.positions.delete(key);
    } else {
      this.positions.set(key, position);
    }

    await this.invalidateCaches();

    const latestPosition = this.positions.get(key) ?? {
      ...position,
      shares: 0,
      principalEth: 0,
      rewardsAccruedEth: 0,
      feesAccruedEth: 0,
    };

    return {
      ...this.toPositionView(latestPosition, pool),
      withdrawnEth: this.formatEth(withdrawnEth),
      claimedRewardsEth: this.formatEth(claimedRewardsEth),
      claimedFeesEth: this.formatEth(claimedFeesEth),
    };
  }

  async getUserPositions(userId: string): Promise<LiquidityPositionView[]> {
    const now = new Date();
    const userPositions = [...this.positions.values()].filter(
      (position) => position.userId === userId,
    );

    userPositions.forEach((position) => {
      const pool = this.pools.get(position.marketId);
      if (pool) this.accruePosition(position, pool, now);
    });

    return userPositions.map((position) => {
      const pool = this.pools.get(position.marketId) ?? this.createEmptyPool(position.marketId);
      return this.toPositionView(position, pool);
    });
  }

  async getLiquidityAnalytics(): Promise<LiquidityAnalytics> {
    const cached = await this.cache.get<LiquidityAnalytics>(LP_ANALYTICS_KEY);
    if (cached) return cached;

    const now = new Date();
    this.positions.forEach((position) => {
      const pool = this.pools.get(position.marketId);
      if (pool) this.accruePosition(position, pool, now);
    });

    const positions = [...this.positions.values()];
    const providers = new Set(positions.map((p) => p.userId));
    const pools = [...this.pools.values()];
    const totals = positions.reduce(
      (acc, position) => {
        const pool = this.pools.get(position.marketId);
        const positionValue = this.estimatePositionValue(position, pool);
        acc.principal += position.principalEth;
        acc.rewards += position.rewardsAccruedEth + position.claimedRewardsEth;
        acc.fees += position.feesAccruedEth + position.claimedFeesEth;
        acc.positionValue += positionValue;
        return acc;
      },
      { principal: 0, rewards: 0, fees: 0, positionValue: 0 },
    );

    const topProviders = [...providers]
      .map((userId) => {
        const providerPositions = positions.filter((p) => p.userId === userId);
        const value = providerPositions.reduce(
          (sum, position) =>
            sum +
            this.estimatePositionValue(position, this.pools.get(position.marketId)),
          0,
        );
        const earnings = providerPositions.reduce(
          (sum, position) =>
            sum +
            position.rewardsAccruedEth +
            position.feesAccruedEth +
            position.claimedRewardsEth +
            position.claimedFeesEth,
          0,
        );
        return {
          userId,
          estimatedValueEth: this.formatEth(value),
          totalEarnedEth: this.formatEth(earnings),
          positions: providerPositions.length,
        };
      })
      .sort((a, b) => Number.parseFloat(b.estimatedValueEth) - Number.parseFloat(a.estimatedValueEth))
      .slice(0, 10);

    const marketBreakdown = pools.map((pool) => {
      const marketPositions = positions.filter((p) => p.marketId === pool.marketId);
      const rewards = marketPositions.reduce(
        (sum, p) => sum + p.rewardsAccruedEth + p.claimedRewardsEth,
        0,
      );
      const fees = marketPositions.reduce(
        (sum, p) => sum + p.feesAccruedEth + p.claimedFeesEth,
        0,
      );
      return {
        marketId: pool.marketId,
        providers: marketPositions.length,
        totalLiquidityEth: this.formatEth(pool.totalLiquidityEth),
        totalRewardsEth: this.formatEth(rewards),
        totalFeesEth: this.formatEth(fees),
        autoManagedProviders: marketPositions.filter((p) => p.autoManage).length,
      };
    });

    const estimatedApy = totals.principal > 0 ? ((totals.rewards + totals.fees) / totals.principal) * 100 : 0;

    const analytics: LiquidityAnalytics = {
      generatedAt: now.toISOString(),
      totalProviders: providers.size,
      totalTrackedMarkets: pools.length,
      totalLiquidityEth: this.formatEth(
        pools.reduce((sum, pool) => sum + pool.totalLiquidityEth, 0),
      ),
      totalPrincipalEth: this.formatEth(totals.principal),
      totalRewardsEth: this.formatEth(totals.rewards),
      totalFeesEth: this.formatEth(totals.fees),
      averageEstimatedApy: this.round6(estimatedApy),
      topProviders,
      marketBreakdown,
    };

    await this.cache.set(LP_ANALYTICS_KEY, analytics, CACHE_TTL);
    return analytics;
  }

  async runAutomation(userId: string): Promise<AutomationExecution[]> {
    const now = new Date();
    const executions: AutomationExecution[] = [];

    const userPositions = [...this.positions.values()].filter(
      (position) => position.userId === userId && position.autoManage,
    );

    for (const position of userPositions) {
      const market = this.marketResolver.getMarket(position.marketId);
      const pool = this.pools.get(position.marketId);
      if (!market || !pool) continue;

      this.accruePosition(position, pool, now);
      const currentYesRatio = this.marketYesRatio(market);
      const deviation = math.abs(currentYesRatio - position.targetYesRatio);

      if (deviation >= AUTOMATION_THRESHOLD) {
        const bonusReward = this.round12(position.principalEth * 0.0015 * deviation);
        position.rewardsAccruedEth = this.round12(position.rewardsAccruedEth + bonusReward);
        position.automationExecutions += 1;
        position.updatedAt = now;
        position.lastAccrualAt = now;
        this.positions.set(this.positionKey(position.userId, position.marketId), position);

        executions.push({
          marketId: position.marketId,
          userId,
          action: 'REBALANCED',
          bonusRewardEth: this.formatEth(bonusReward),
          deviation: this.round6(deviation),
          executedAt: now.toISOString(),
        });
      } else {
        executions.push({
          marketId: position.marketId,
          userId,
          action: 'SKIPPED',
          bonusRewardEth: this.formatEth(0),
          deviation: this.round6(deviation),
          executedAt: now.toISOString(),
        });
      }
    }

    if (executions.some((item) => item.action === 'REBALANCED')) {
      await this.invalidateCaches();
    }

    return executions;
  }

  async configureAutomation(
    userId: string,
    marketId: string,
    autoManage?: boolean,
    targetYesRatio?: number,
  ): Promise<LiquidityPositionView> {
    const key = this.positionKey(userId, marketId);
    const position = this.positions.get(key);
    if (!position) throw new NotFoundException('Liquidity position not found');
    const pool = this.pools.get(marketId) ?? this.createEmptyPool(marketId);

    const now = new Date();
    this.accruePosition(position, pool, now);

    if (typeof autoManage === 'boolean') {
      position.autoManage = autoManage;
    }
    if (typeof targetYesRatio === 'number') {
      position.targetYesRatio = this.normalizeTargetRatio(targetYesRatio);
    }
    position.updatedAt = now;
    position.lastAccrualAt = now;

    this.positions.set(key, position);
    await this.invalidateCaches();
    return this.toPositionView(position, pool);
  }

  async getMarketLiquidity(marketId: string): Promise<MarketLiquidity | null> {
    const market = this.marketResolver.getMarket(marketId);
    if (!market) return null;
    return this.toMarketLiquidity(market);
  }

  async getDepthAnalysis(): Promise<LiquidityDepth[]> {
    const report = await this.getReport();
    return report.depth;
  }

  async getHealthIndicators(): Promise<LiquidityHealth> {
    const report = await this.getReport();
    return report.health;
  }

  // ── Scheduled refresh ───────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshReport(): Promise<void> {
    this.logger.log('Refreshing liquidity report...');
    await this.buildAndCacheReport();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async accrueAllPositions(): Promise<void> {
    if (!this.positions.size) return;

    const now = new Date();
    this.positions.forEach((position) => {
      const pool = this.pools.get(position.marketId);
      if (pool) {
        this.accruePosition(position, pool, now);
      }
    });

    await this.invalidateCaches();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async buildAndCacheReport(): Promise<LiquidityReport> {
    const markets = this.marketResolver.getAllMarkets();
    const active = markets.filter((m) => m.status === 'active');

    const marketLiquidity = markets.map((m) => this.toMarketLiquidity(m));
    const depth = marketLiquidity.map((ml) => this.toDepth(ml));
    const health = this.computeHealth(depth, marketLiquidity);

    const totalWei = markets.reduce(
      (sum, m) => sum + m.totalYesStake + m.totalNoStake,
      0n,
    );
    const totalEth = weiToEth(totalWei);
    const avgEth = markets.length
      ? math.round(totalEth / markets.length, 6)
      : 0;

    const report: LiquidityReport = {
      generatedAt: new Date().toISOString(),
      totalMarkets: markets.length,
      activeMarkets: active.length,
      totalLiquidity: `${math.round(totalEth, 6)} ETH`,
      avgLiquidityPerMarket: `${avgEth} ETH`,
      markets: marketLiquidity,
      depth,
      health,
    };

    await this.cache.set(REPORT_KEY, report, CACHE_TTL);
    return report;
  }

  private ensurePool(market: Market): LiquidityPoolState {
    const existing = this.pools.get(market.id);
    if (existing) return existing;

    const seededLiquidity = this.round12(weiToEth(market.totalYesStake + market.totalNoStake));
    const now = new Date();
    const pool: LiquidityPoolState = {
      marketId: market.id,
      totalLiquidityEth: seededLiquidity,
      totalShares: seededLiquidity,
      totalFeesDistributedEth: 0,
      totalRewardsDistributedEth: 0,
      updatedAt: now,
    };

    this.pools.set(market.id, pool);
    return pool;
  }

  private createEmptyPool(marketId: string): LiquidityPoolState {
    return {
      marketId,
      totalLiquidityEth: 0,
      totalShares: 0,
      totalFeesDistributedEth: 0,
      totalRewardsDistributedEth: 0,
      updatedAt: new Date(),
    };
  }

  private accruePosition(
    position: LiquidityPosition,
    pool: LiquidityPoolState,
    now: Date,
  ): void {
    const elapsedMs = now.getTime() - position.lastAccrualAt.getTime();
    if (elapsedMs <= 0) return;

    if (position.shares <= 0 || pool.totalShares <= 0 || pool.totalLiquidityEth <= 0) {
      position.lastAccrualAt = now;
      return;
    }

    const hours = elapsedMs / (1000 * 60 * 60);
    const shareRatio = position.shares / pool.totalShares;
    const exposure = pool.totalLiquidityEth * shareRatio;
    const utilizationBoost = 1 + Math.min(0.75, shareRatio * 2.5);

    const rewardRatePerHour = BASE_REWARD_APY / (365 * 24);
    const feeRatePerHour = BASE_FEE_APY / (365 * 24);

    const reward = this.round12(exposure * rewardRatePerHour * hours * utilizationBoost);
    const fee = this.round12(exposure * feeRatePerHour * hours * (1 + shareRatio));

    position.rewardsAccruedEth = this.round12(position.rewardsAccruedEth + reward);
    position.feesAccruedEth = this.round12(position.feesAccruedEth + fee);
    position.updatedAt = now;
    position.lastAccrualAt = now;
  }

  private toPositionView(
    position: LiquidityPosition,
    pool: LiquidityPoolState,
  ): LiquidityPositionView {
    const shareRatio =
      pool.totalShares > 0 ? this.round6(position.shares / pool.totalShares) : 0;

    const positionValue = this.estimatePositionValue(position, pool);
    const totalEarned =
      position.rewardsAccruedEth +
      position.feesAccruedEth +
      position.claimedRewardsEth +
      position.claimedFeesEth;

    return {
      marketId: position.marketId,
      walletAddress: position.walletAddress,
      shares: this.round6(position.shares),
      shareRatio,
      principalEth: this.formatEth(position.principalEth),
      removedPrincipalEth: this.formatEth(position.removedPrincipalEth),
      rewardsAccruedEth: this.formatEth(position.rewardsAccruedEth),
      feesAccruedEth: this.formatEth(position.feesAccruedEth),
      totalEarnedEth: this.formatEth(totalEarned),
      estimatedPositionValueEth: this.formatEth(positionValue),
      autoManage: position.autoManage,
      targetYesRatio: this.round6(position.targetYesRatio),
      createdAt: position.createdAt.toISOString(),
      updatedAt: position.updatedAt.toISOString(),
      lastAccrualAt: position.lastAccrualAt.toISOString(),
      automationExecutions: position.automationExecutions,
    };
  }

  private estimatePositionValue(
    position: LiquidityPosition,
    pool?: LiquidityPoolState,
  ): number {
    if (!pool || pool.totalShares <= 0 || pool.totalLiquidityEth <= 0) {
      return this.round12(position.principalEth + position.rewardsAccruedEth + position.feesAccruedEth);
    }

    const underlying = math.number(
      math.round(
        math.divide(math.multiply(position.shares, pool.totalLiquidityEth), pool.totalShares),
        12,
      ),
    );
    return this.round12(underlying + position.rewardsAccruedEth + position.feesAccruedEth);
  }

  private positionKey(userId: string, marketId: string): string {
    return `${userId}:${marketId}`;
  }

  private assertPositive(value: number, message: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(message);
    }
  }

  private normalizeTargetRatio(value?: number): number {
    if (value === undefined || value === null) return 0.5;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new BadRequestException('targetYesRatio must be between 0 and 1');
    }
    return this.round6(value);
  }

  private normalizeWallet(address: string): string {
    if (!web3.utils.isAddress(address)) {
      throw new BadRequestException('Invalid wallet address');
    }
    return web3.utils.toChecksumAddress(address);
  }

  private marketYesRatio(market: Market): number {
    const yes = weiToEth(market.totalYesStake);
    const no = weiToEth(market.totalNoStake);
    const total = yes + no;
    if (total <= 0) return 0.5;
    return this.round6(yes / total);
  }

  private round6(value: number): number {
    return math.number(math.round(value, 6));
  }

  private round12(value: number): number {
    return math.number(math.round(value, 12));
  }

  private formatEth(value: number): string {
    return this.round12(value).toFixed(12);
  }

  private async invalidateCaches(): Promise<void> {
    await Promise.all([
      this.cache.del(REPORT_KEY),
      this.cache.del(LP_ANALYTICS_KEY),
    ]);
  }

  private toMarketLiquidity(m: Market): MarketLiquidity {
    const yes = weiToEth(m.totalYesStake);
    const no = weiToEth(m.totalNoStake);
    const total = yes + no;
    const yesRatio = total > 0 ? math.round(yes / total, 4) : 0.5;
    const noRatio = total > 0 ? math.round(no / total, 4) : 0.5;

    return {
      marketId: m.id,
      title: m.title,
      yesStake: `${math.round(yes, 6)} ETH`,
      noStake: `${math.round(no, 6)} ETH`,
      totalLiquidity: `${math.round(total, 6)} ETH`,
      yesRatio: yesRatio,
      noRatio: noRatio,
      status: m.status,
    };
  }

  private toDepth(ml: MarketLiquidity): LiquidityDepth {
    const imbalance = math.abs(ml.yesRatio - 0.5);
    const depthScore = math.round(1 - imbalance * 2, 4); // 1 = balanced, 0 = fully one-sided
    const dominantSide: 'YES' | 'NO' | 'BALANCED' =
      imbalance < 0.05 ? 'BALANCED' : ml.yesRatio > 0.5 ? 'YES' : 'NO';

    return {
      marketId: ml.marketId,
      imbalance: imbalance,
      dominantSide,
      depthScore,
    };
  }

  private computeHealth(
    depth: LiquidityDepth[],
    markets: MarketLiquidity[],
  ): LiquidityHealth {
    const scores = depth.map((d) => d.depthScore);
    const avgDepthScore = scores.length
      ? math.round(math.mean(...scores), 4)
      : 1;

    const lowLiquidityMarkets = markets
      .filter((m) => parseFloat(m.totalLiquidity) < 0.01)
      .map((m) => m.marketId);

    const imbalancedMarkets = depth
      .filter((d) => d.imbalance > 0.3)
      .map((d) => d.marketId);

    let status: LiquidityHealth['status'] = 'HEALTHY';
    if (
      avgDepthScore < 0.5 ||
      lowLiquidityMarkets.length > depth.length * 0.5
    ) {
      status = 'CRITICAL';
    } else if (avgDepthScore < 0.75 || imbalancedMarkets.length > 0) {
      status = 'WARNING';
    }

    return { status, avgDepthScore, lowLiquidityMarkets, imbalancedMarkets };
  }
}
