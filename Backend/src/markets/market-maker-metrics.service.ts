import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import type { Market } from './market-resolver.service';

const MARKET_MAKER_METRICS_ABI = [
  'function isFactoryMarketLinked(address factoryMarket) view returns (bool)',
  'function getMarketIdForFactoryMarket(address factoryMarket) view returns (uint256)',
  'function markets(uint256) view returns (string description,uint256 b,uint256 numOutcomes,uint256[] quantities,bool resolved,uint256 winningOutcome,address creator)',
  'function getPrice(uint256 marketId, uint256 outcome) view returns (uint256)',
  'function getMarketReserve(uint256 marketId) view returns (uint256)',
  'function getMarketLiability(uint256 marketId) view returns (uint256)',
];
const TRADING_METRICS_ABI = [
  'function marketMaker() view returns (address)',
  'function feeBps() view returns (uint256)',
];
const TRADE_EVENT_INTERFACE = new ethers.Interface([
  'event SharesBought(uint256 indexed marketId,address indexed buyer,uint256 outcome,uint256 shares,uint256 cost)',
  'event SharesSold(uint256 indexed marketId,address indexed seller,uint256 outcome,uint256 shares,uint256 proceeds)',
]);
const TRADE_LOG_RANGE = 2_000;

export interface MarketMetrics {
  yesPrice: number | null;
  noPrice: number | null;
  tradingVolume: number | null;
  tradingVolumeWindow: 'ALL_TIME';
  tradingVolumeBaseUnits: string | null;
  availableLiquidity: number | null;
  availableLiquidityBaseUnits: string | null;
  fees: {
    buyBps: string | null;
    sellBps: '0';
  };
  feePercent: number | null;
  sources: {
    price: 'MARKET_MAKER' | null;
    volume: 'MARKET_MAKER_EVENTS' | null;
    liquidity: 'MARKET_MAKER' | null;
    fees: 'TRADING_AND_MARKET_MAKER' | null;
  };
}

const unavailableMetrics = (): MarketMetrics => ({
  yesPrice: null,
  noPrice: null,
  tradingVolume: null,
  tradingVolumeWindow: 'ALL_TIME',
  tradingVolumeBaseUnits: null,
  availableLiquidity: null,
  availableLiquidityBaseUnits: null,
  fees: { buyBps: null, sellBps: '0' },
  feePercent: null,
  sources: {
    price: null,
    volume: null,
    liquidity: null,
    fees: null,
  },
});

@Injectable()
export class MarketMakerMetricsService {
  constructor(private readonly blockchain: BlockchainService) {}

  async getMetrics(markets: Market[]): Promise<MarketMetrics[]> {
    const provider = this.blockchain.getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (!Number.isSafeInteger(chainId)) {
      throw new ServiceUnavailableException(
        `Unsupported RPC chain ID: ${network.chainId}`,
      );
    }

    const deployment = this.blockchain
      .getDeployedContracts('MarketMaker')
      .find((entry) => entry.chainId === chainId);
    if (!deployment) {
      return markets.map(() => unavailableMetrics());
    }

    const deploymentAddress = ethers.getAddress(deployment.address);
    const blockNumber = await provider.getBlockNumber();
    const code = await provider.getCode(deploymentAddress, blockNumber);
    if (code === '0x') {
      throw new ServiceUnavailableException(
        `No MarketMaker contract code at ${deploymentAddress} on chain ${chainId}`,
      );
    }

    const marketMaker = new ethers.Contract(
      deploymentAddress,
      MARKET_MAKER_METRICS_ABI,
      provider,
    );
    const overrides = { blockTag: blockNumber };
    const feeBps = await this.getConfiguredBuyFee(
      provider,
      chainId,
      deploymentAddress,
      blockNumber,
    );
    const metrics = await Promise.all(
      markets.map(async (market) => {
        if (
          !market.marketAddress ||
          (market.chainId !== undefined && market.chainId !== chainId)
        ) {
          return unavailableMetrics();
        }

        const marketAddress = ethers.getAddress(market.marketAddress);
        const linked = await marketMaker
          .getFunction('isFactoryMarketLinked')
          .staticCall(marketAddress, overrides);
        if (!linked) return unavailableMetrics();

        const canonicalMarketId = BigInt(
          await marketMaker
            .getFunction('getMarketIdForFactoryMarket')
            .staticCall(marketAddress, overrides),
        );
        const details = await marketMaker
          .getFunction('markets')
          .staticCall(canonicalMarketId, overrides);
        if (BigInt(details.numOutcomes) < 2n) {
          throw new ServiceUnavailableException(
            `MarketMaker market ${canonicalMarketId} has fewer than two outcomes`,
          );
        }

        const [
          yesPriceRaw,
          noPriceRaw,
          reserveRaw,
          liabilityRaw,
          tradingVolume,
        ] =
          await Promise.all([
            marketMaker
              .getFunction('getPrice')
              .staticCall(canonicalMarketId, 0, overrides),
            marketMaker
              .getFunction('getPrice')
              .staticCall(canonicalMarketId, 1, overrides),
            marketMaker
              .getFunction('getMarketReserve')
              .staticCall(canonicalMarketId, overrides),
            marketMaker
              .getFunction('getMarketLiability')
              .staticCall(canonicalMarketId, overrides),
            this.getTradingVolume(
              provider,
              deploymentAddress,
              canonicalMarketId,
              market.creationBlockNumber,
              blockNumber,
            ),
          ]);
        const reserve = BigInt(reserveRaw);
        const liability = BigInt(liabilityRaw);
        const availableLiquidity =
          reserve > liability ? reserve - liability : 0n;
        return {
          yesPrice: Number(ethers.formatUnits(BigInt(yesPriceRaw), 18)),
          noPrice: Number(ethers.formatUnits(BigInt(noPriceRaw), 18)),
          tradingVolume:
            tradingVolume === null
              ? null
              : Number(ethers.formatUnits(tradingVolume, 18)),
          tradingVolumeWindow: 'ALL_TIME' as const,
          tradingVolumeBaseUnits: tradingVolume?.toString() ?? null,
          availableLiquidity: Number(
            ethers.formatUnits(availableLiquidity, 18),
          ),
          availableLiquidityBaseUnits: availableLiquidity.toString(),
          fees: { buyBps: feeBps?.toString() ?? null, sellBps: '0' as const },
          feePercent: feeBps === null ? null : Number(feeBps) / 100,
          sources: {
            price: 'MARKET_MAKER' as const,
            volume:
              tradingVolume === null
                ? null
                : ('MARKET_MAKER_EVENTS' as const),
            liquidity: 'MARKET_MAKER' as const,
            fees:
              feeBps === null ? null : ('TRADING_AND_MARKET_MAKER' as const),
          },
        };
      }),
    );

    return metrics;
  }

  private async getTradingVolume(
    provider: ethers.JsonRpcProvider,
    marketMakerAddress: string,
    marketId: bigint,
    creationBlockNumber: number | undefined,
    headBlock: number,
  ): Promise<bigint | null> {
    if (creationBlockNumber === undefined) return null;

    const marketTopic = ethers.zeroPadValue(ethers.toBeHex(marketId), 32);
    const buyTopic = TRADE_EVENT_INTERFACE.getEvent('SharesBought')!.topicHash;
    const sellTopic = TRADE_EVENT_INTERFACE.getEvent('SharesSold')!.topicHash;
    let volume = 0n;

    for (
      let fromBlock = creationBlockNumber;
      fromBlock <= headBlock;
      fromBlock += TRADE_LOG_RANGE
    ) {
      const toBlock = Math.min(fromBlock + TRADE_LOG_RANGE - 1, headBlock);
      const logs = await provider.getLogs({
        address: marketMakerAddress,
        topics: [[buyTopic, sellTopic], marketTopic],
        fromBlock,
        toBlock,
      });
      for (const log of logs) {
        const parsed = TRADE_EVENT_INTERFACE.parseLog(log);
        if (parsed?.name === 'SharesBought') {
          volume += BigInt(parsed.args.cost);
        } else if (parsed?.name === 'SharesSold') {
          volume += BigInt(parsed.args.proceeds);
        }
      }
    }

    return volume;
  }

  private async getConfiguredBuyFee(
    provider: ethers.JsonRpcProvider,
    chainId: number,
    marketMakerAddress: string,
    blockNumber: number,
  ): Promise<bigint | null> {
    const deployments = this.blockchain
      .getDeployedContracts('Trading')
      .filter((entry) => entry.chainId === chainId);
    for (const deployment of deployments) {
      const tradingAddress = ethers.getAddress(deployment.address);
      const code = await provider.getCode(tradingAddress, blockNumber);
      if (code === '0x') {
        throw new ServiceUnavailableException(
          `No Trading contract code at ${tradingAddress} on chain ${chainId}`,
        );
      }

      const trading = new ethers.Contract(
        tradingAddress,
        TRADING_METRICS_ABI,
        provider,
      );
      const overrides = { blockTag: blockNumber };
      const configuredMarketMaker = await trading
        .getFunction('marketMaker')
        .staticCall(overrides);
      if (
        ethers.getAddress(String(configuredMarketMaker)) === marketMakerAddress
      ) {
        return BigInt(
          await trading.getFunction('feeBps').staticCall(overrides),
        );
      }
    }
    return null;
  }
}
