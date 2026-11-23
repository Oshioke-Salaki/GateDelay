import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import type { Market } from './market-resolver.service';
import { MarketQuoteQueryDto } from './dto/market-quote.dto';

const MARKET_MAKER_QUOTE_ABI = [
  'function isFactoryMarketLinked(address factoryMarket) view returns (bool)',
  'function getMarketIdForFactoryMarket(address factoryMarket) view returns (uint256)',
  'function getCostToBuy(uint256 marketId, uint256 outcome, uint256 shares) view returns (uint256)',
  'function getProceedsToSell(uint256 marketId, uint256 outcome, uint256 shares) view returns (uint256)',
];

@Injectable()
export class MarketMakerQuoteService {
  constructor(private readonly blockchain: BlockchainService) {}

  async quote(market: Market, query: MarketQuoteQueryDto) {
    const provider = this.blockchain.getProvider();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (!Number.isSafeInteger(chainId)) {
      throw new ServiceUnavailableException(
        `Unsupported RPC chain ID: ${network.chainId}`,
      );
    }

    if (market.chainId !== undefined && market.chainId !== chainId) {
      throw new ConflictException(
        `Market ${market.id} belongs to chain ${market.chainId}, but the quote RPC is connected to chain ${chainId}`,
      );
    }

    const deployment = this.blockchain
      .getDeployedContracts('MarketMaker')
      .find((entry) => entry.chainId === chainId);
    if (!deployment) {
      throw new ServiceUnavailableException(
        `MarketMaker deployment is not configured for chain ${chainId}`,
      );
    }
    if (!market.marketAddress) {
      throw new NotFoundException(
        `Market ${market.id} is not linked to a canonical MarketMaker market`,
      );
    }

    const marketAddress = ethers.getAddress(market.marketAddress);
    const deploymentAddress = ethers.getAddress(deployment.address);
    const blockNumber = await provider.getBlockNumber();
    const blockIdentity = await provider.getBlock(blockNumber);
    if (!blockIdentity) {
      throw new ServiceUnavailableException(
        `Unable to retrieve quote block ${blockNumber} on chain ${chainId}`,
      );
    }
    const code = await provider.getCode(deploymentAddress, blockNumber);
    if (code === '0x') {
      throw new ServiceUnavailableException(
        `No MarketMaker contract code at ${deploymentAddress} on chain ${chainId}`,
      );
    }

    const contract = new ethers.Contract(
      deploymentAddress,
      MARKET_MAKER_QUOTE_ABI,
      provider,
    );
    const blockTagOverrides = { blockTag: blockNumber };
    const isLinked = await contract
      .getFunction('isFactoryMarketLinked')
      .staticCall(marketAddress, blockTagOverrides);
    if (!isLinked) {
      throw new NotFoundException(
        `Market ${market.id} is not linked to a canonical MarketMaker market`,
      );
    }

    const canonicalMarketId = BigInt(
      await contract
        .getFunction('getMarketIdForFactoryMarket')
        .staticCall(marketAddress, blockTagOverrides),
    );
    const shares = BigInt(query.shares);
    if (shares > ethers.MaxUint256) {
      throw new BadRequestException('shares exceeds the uint256 contract limit');
    }
    const quoteAmount = BigInt(
      query.side === 'buy'
        ? await contract
            .getFunction('getCostToBuy')
            .staticCall(
              canonicalMarketId,
              query.outcome,
              shares,
              blockTagOverrides,
            )
        : await contract
            .getFunction('getProceedsToSell')
            .staticCall(
              canonicalMarketId,
              query.outcome,
              shares,
              blockTagOverrides,
            ),
    );
    const verifiedBlock = await provider.getBlock(blockNumber);
    if (!verifiedBlock) {
      throw new ServiceUnavailableException(
        `Unable to retrieve quote block ${blockNumber} on chain ${chainId}`,
      );
    }
    if (verifiedBlock.hash !== blockIdentity.hash) {
      throw new ServiceUnavailableException(
        `Quote block ${blockNumber} changed while the quote was being read`,
      );
    }

    return {
      success: true,
      data: {
        side: query.side,
        shares: shares.toString(),
        quoteAmount: quoteAmount.toString(),
        unit: 'base-units',
        chainId,
        deployment: {
          contractName: 'MarketMaker',
          contractAddress: deploymentAddress,
          abiVersion: deployment.abiVersion,
        },
        market: {
          id: market.id,
          contractAddress: marketAddress,
          canonicalMarketId: canonicalMarketId.toString(),
        },
        outcome: { index: query.outcome },
        block: {
          number: blockNumber,
          hash: blockIdentity.hash,
        },
      },
    };
  }
}
