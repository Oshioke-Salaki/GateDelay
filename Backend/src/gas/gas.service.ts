import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import axios from 'axios';

export interface GasTier {
  maxFeePerGas: string; // gwei
  maxPriorityFeePerGas: string; // gwei
  estimatedSeconds: number;
}

export interface GasEstimate {
  network: string;
  baseFeeGwei: string;
  tiers: {
    slow: GasTier;
    standard: GasTier;
    fast: GasTier;
  };
  recommendation: string;
  source: string;
  cachedAt: string;
}

const CACHE_TTL_MS = 30_000; // 30 seconds

@Injectable()
export class GasService {
  private readonly logger = new Logger(GasService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly etherscanKey: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    const rpcUrl = this.config.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.etherscanKey = this.config.get<string>('ETHERSCAN_API_KEY', '');
  }

  async getEstimate(network = 'mantle'): Promise<GasEstimate> {
    const cacheKey = `gas:estimate:${network}`;
    const cached = await this.cache.get<GasEstimate>(cacheKey);
    if (cached) return cached;

    const estimate = await this.buildEstimate(network);
    await this.cache.set(cacheKey, estimate, CACHE_TTL_MS);
    return estimate;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async buildEstimate(network: string): Promise<GasEstimate> {
    let source = 'provider';
    let feeData: ethers.FeeData;

    try {
      feeData = await this.provider.getFeeData();
    } catch (err) {
      this.logger.error('Failed to fetch fee data from provider', err);
      // Return a safe, clearly-labelled fallback
      return this.fallbackEstimate(network);
    }

    // Optionally enrich with Etherscan data for mainnet
    if (this.etherscanKey && network === 'mainnet') {
      try {
        const etherscanData = await this.fetchEtherscanGas();
        if (etherscanData) {
          source = 'etherscan';
          return this.buildFromEtherscan(network, etherscanData);
        }
      } catch {
        this.logger.warn(
          'Etherscan gas fetch failed — falling back to provider',
        );
      }
    }

    return this.buildFromFeeData(network, feeData, source);
  }

  private buildFromFeeData(
    network: string,
    feeData: ethers.FeeData,
    source: string,
  ): GasEstimate {
    const baseFee = feeData.gasPrice ?? 0n;

    // Derive tiers from base fee
    const slow: GasTier = {
      maxFeePerGas: this.toGwei(baseFee + this.gwei(1n)),
      maxPriorityFeePerGas: this.toGwei(this.gwei(1n)),
      estimatedSeconds: 120,
    };
    const standard: GasTier = {
      maxFeePerGas: this.toGwei(baseFee + this.gwei(2n)),
      maxPriorityFeePerGas: this.toGwei(this.gwei(2n)),
      estimatedSeconds: 30,
    };
    const fast: GasTier = {
      maxFeePerGas: this.toGwei(baseFee + this.gwei(5n)),
      maxPriorityFeePerGas: this.toGwei(this.gwei(5n)),
      estimatedSeconds: 10,
    };

    return {
      network,
      baseFeeGwei: this.toGwei(baseFee),
      tiers: { slow, standard, fast },
      recommendation: this.buildRecommendation(standard),
      source,
      cachedAt: new Date().toISOString(),
    };
  }

  private async fetchEtherscanGas(): Promise<Record<string, string> | null> {
    const url = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${this.etherscanKey}`;
    const { data } = await axios.get<{ result: Record<string, string> }>(url, {
      timeout: 5000,
    });
    return data?.result ?? null;
  }

  private buildFromEtherscan(
    network: string,
    result: Record<string, string>,
  ): GasEstimate {
    const safeGwei = parseFloat(result.SafeGasPrice ?? '0');
    const proposeGwei = parseFloat(result.ProposeGasPrice ?? '0');
    const fastGwei = parseFloat(result.FastGasPrice ?? '0');
    const baseFeeGwei = parseFloat(result.suggestBaseFee ?? '0');

    const makeTier = (price: number, seconds: number): GasTier => ({
      maxFeePerGas: price.toFixed(2),
      maxPriorityFeePerGas: Math.max(0, price - baseFeeGwei).toFixed(2),
      estimatedSeconds: seconds,
    });

    const tiers = {
      slow: makeTier(safeGwei, 120),
      standard: makeTier(proposeGwei, 30),
      fast: makeTier(fastGwei, 10),
    };

    return {
      network,
      baseFeeGwei: baseFeeGwei.toFixed(2),
      tiers,
      recommendation: this.buildRecommendation(tiers.standard),
      source: 'etherscan',
      cachedAt: new Date().toISOString(),
    };
  }

  private buildRecommendation(standard: GasTier): string {
    const fee = parseFloat(standard.maxFeePerGas);
    if (fee < 5) return 'Gas prices are very low — good time to transact.';
    if (fee < 20)
      return 'Gas prices are moderate — standard transactions are cost-effective.';
    if (fee < 50)
      return 'Gas prices are elevated — consider waiting or use the slow tier.';
    return 'Gas prices are high — only submit time-sensitive transactions.';
  }

  private fallbackEstimate(network: string): GasEstimate {
    return {
      network,
      baseFeeGwei: '0',
      tiers: {
        slow: {
          maxFeePerGas: '1',
          maxPriorityFeePerGas: '1',
          estimatedSeconds: 120,
        },
        standard: {
          maxFeePerGas: '2',
          maxPriorityFeePerGas: '2',
          estimatedSeconds: 30,
        },
        fast: {
          maxFeePerGas: '5',
          maxPriorityFeePerGas: '5',
          estimatedSeconds: 10,
        },
      },
      recommendation: 'Gas data unavailable — using default estimates.',
      source: 'fallback',
      cachedAt: new Date().toISOString(),
    };
  }

  private gwei(n: bigint): bigint {
    return n * 1_000_000_000n;
  }

  private toGwei(wei: bigint): string {
    return ethers.formatUnits(wei, 'gwei');
  }
}
