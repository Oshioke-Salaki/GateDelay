import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Cache } from 'cache-manager';
import { create, all } from 'mathjs';
import { MarketResolverService, Market } from '../markets/market-resolver.service';

const math = create(all);

const CACHE_TTL = 60_000; // 1 minute
const REPORT_KEY = 'liquidity:report';

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
  imbalance: number;       // |yesRatio - 0.5|, 0 = perfectly balanced
  dominantSide: 'YES' | 'NO' | 'BALANCED';
  depthScore: number;      // 0–1, higher = deeper / more balanced
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

const WEI = 1e18;

function weiToEth(wei: bigint): number {
  return Number(wei) / WEI;
}

@Injectable()
export class LiquidityService {
  private readonly logger = new Logger(LiquidityService.name);

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
      yesRatio: yesRatio as number,
      noRatio: noRatio as number,
      status: m.status,
    };
  }

  private toDepth(ml: MarketLiquidity): LiquidityDepth {
    const imbalance = math.abs(ml.yesRatio - 0.5) as number;
    const depthScore = math.round(1 - imbalance * 2, 4) as number; // 1 = balanced, 0 = fully one-sided
    const dominantSide: 'YES' | 'NO' | 'BALANCED' =
      imbalance < 0.05 ? 'BALANCED' : ml.yesRatio > 0.5 ? 'YES' : 'NO';

    return { marketId: ml.marketId, imbalance: imbalance as number, dominantSide, depthScore };
  }

  private computeHealth(
    depth: LiquidityDepth[],
    markets: MarketLiquidity[],
  ): LiquidityHealth {
    const scores = depth.map((d) => d.depthScore);
    const avgDepthScore =
      scores.length
        ? (math.round(math.mean(...scores) as number, 4) as number)
        : 1;

    const lowLiquidityMarkets = markets
      .filter((m) => parseFloat(m.totalLiquidity) < 0.01)
      .map((m) => m.marketId);

    const imbalancedMarkets = depth
      .filter((d) => d.imbalance > 0.3)
      .map((d) => d.marketId);

    let status: LiquidityHealth['status'] = 'HEALTHY';
    if (avgDepthScore < 0.5 || lowLiquidityMarkets.length > depth.length * 0.5) {
      status = 'CRITICAL';
    } else if (avgDepthScore < 0.75 || imbalancedMarkets.length > 0) {
      status = 'WARNING';
    }

    return { status, avgDepthScore, lowLiquidityMarkets, imbalancedMarkets };
  }
}
