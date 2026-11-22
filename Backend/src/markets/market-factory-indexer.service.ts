import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import type { Model } from 'mongoose';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import type { DeploymentEntry } from '../blockchain/deployment-registry';
import {
  isMarketResolutionCriteria,
  MarketResolverService,
  type MarketResolutionCriteria,
} from './market-resolver.service';
import {
  MarketFactoryCheckpoint,
  MarketFactoryCheckpointDocument,
} from './schemas/market.schema';

const FACTORY_EVENT_INTERFACE = new ethers.Interface([
  'event MarketCreated(address indexed market, address indexed creator, address indexed collateralToken, uint256 resolutionDeadline)',
]);
const MARKET_METADATA_ABI = [
  'function metadataURI() view returns (string)',
  'function minLiquidity() view returns (uint256)',
];
const BLOCK_RANGE = 1_000;
const MAX_RANGES_PER_SYNC = 10;
const CONFIRMATION_DEPTH = 2;

interface MarketMetadata {
  title?: string;
  description?: string;
  category?: string;
  resolutionCriteria?: MarketResolutionCriteria;
}

@Injectable()
export class MarketFactoryIndexerService implements OnModuleInit {
  private readonly logger = new Logger(MarketFactoryIndexerService.name);
  private syncing = false;
  private warnedNoDeployment = false;
  private readonly warnedChainMismatches = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
    private readonly markets: MarketResolverService,
    @InjectModel(MarketFactoryCheckpoint.name)
    private readonly checkpoints: Model<MarketFactoryCheckpointDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.checkpoints.createIndexes();
    void this.sync().catch((error: unknown) => {
      this.logger.error(
        'Initial market-factory indexing failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  @Cron('*/30 * * * * *')
  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const deployments = this.blockchain.getDeployedContracts('MarketFactory');
      if (deployments.length === 0) {
        if (!this.warnedNoDeployment) {
          this.logger.warn(
            'No MarketFactory deployments configured; market event indexing is idle',
          );
          this.warnedNoDeployment = true;
        }
        return;
      }
      this.warnedNoDeployment = false;

      const provider = this.blockchain.getProvider();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      if (!Number.isSafeInteger(chainId)) {
        throw new Error(`Unsupported RPC chain ID: ${network.chainId}`);
      }

      const head = await provider.getBlockNumber();
      const safeHead = head - CONFIRMATION_DEPTH;
      if (safeHead < 0) return;

      for (const deployment of deployments) {
        if (deployment.chainId !== chainId) {
          const warningKey = `${deployment.chainId}:${deployment.address}`;
          if (!this.warnedChainMismatches.has(warningKey)) {
            this.logger.warn(
              `Skipping MarketFactory ${deployment.address}: configured chain ${deployment.chainId} does not match RPC chain ${chainId}`,
            );
            this.warnedChainMismatches.add(warningKey);
          }
          continue;
        }

        try {
          await this.indexDeployment(deployment, chainId, safeHead, provider);
        } catch (error: unknown) {
          this.logger.error(
            `MarketFactory indexing failed for ${deployment.address} on chain ${chainId}; checkpoint was not advanced past the failed range`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  private async indexDeployment(
    deployment: DeploymentEntry,
    chainId: number,
    safeHead: number,
    provider: ethers.JsonRpcProvider,
  ): Promise<void> {
    const factoryAddress = ethers.getAddress(deployment.address);
    const checkpointId = `${chainId}:${factoryAddress.toLowerCase()}`;
    const configuredStartBlock = Number(
      this.config.get<number>('MARKET_FACTORY_START_BLOCK', 0),
    );
    if (!Number.isSafeInteger(configuredStartBlock) || configuredStartBlock < 0) {
      throw new Error('MARKET_FACTORY_START_BLOCK must be a non-negative integer');
    }

    const checkpoint = await this.checkpoints
      .findOneAndUpdate(
        { id: checkpointId },
        {
          $setOnInsert: {
            id: checkpointId,
            chainId,
            factoryAddress,
            lastProcessedBlock: configuredStartBlock - 1,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
    if (!checkpoint) {
      throw new Error(`Failed to initialize checkpoint ${checkpointId}`);
    }

    let lastProcessedBlock = checkpoint.lastProcessedBlock;
    for (let range = 0; range < MAX_RANGES_PER_SYNC; range += 1) {
      const fromBlock = lastProcessedBlock + 1;
      if (fromBlock > safeHead) return;

      const toBlock = Math.min(fromBlock + BLOCK_RANGE - 1, safeHead);
      const logs = await provider.getLogs({
        address: factoryAddress,
        topics: [FACTORY_EVENT_INTERFACE.getEvent('MarketCreated')!.topicHash],
        fromBlock,
        toBlock,
      });

      for (const log of logs.sort(
        (left, right) =>
          left.blockNumber - right.blockNumber || left.index - right.index,
      )) {
        await this.indexEvent(log, deployment, factoryAddress, chainId, provider);
      }

      const advanced = await this.checkpoints
        .updateOne(
          { id: checkpointId },
          { $max: { lastProcessedBlock: toBlock } },
        )
        .exec();
      if (advanced.matchedCount === 0) {
        throw new Error(`Checkpoint ${checkpointId} disappeared during indexing`);
      }
      lastProcessedBlock = toBlock;
    }
  }

  private async indexEvent(
    log: ethers.Log,
    deployment: DeploymentEntry,
    factoryAddress: string,
    chainId: number,
    provider: ethers.JsonRpcProvider,
  ): Promise<void> {
    const parsed = FACTORY_EVENT_INTERFACE.parseLog({
      topics: log.topics,
      data: log.data,
    });
    if (!parsed || parsed.name !== 'MarketCreated') {
      throw new Error(`Unable to decode MarketCreated log at ${log.blockNumber}`);
    }

    const marketAddress = ethers.getAddress(String(parsed.args.market));
    const creator = ethers.getAddress(String(parsed.args.creator));
    const collateralToken = ethers.getAddress(String(parsed.args.collateralToken));
    const deadlineSeconds = BigInt(parsed.args.resolutionDeadline);
    const deadline = new Date(Number(deadlineSeconds * 1_000n));
    if (!Number.isFinite(deadline.getTime())) {
      throw new Error(`Invalid resolution deadline for market ${marketAddress}`);
    }

    const marketContract = new ethers.Contract(
      marketAddress,
      MARKET_METADATA_ABI,
      provider,
    );
    const [metadataURI, minLiquidity] = await Promise.all([
      marketContract.getFunction('metadataURI')() as Promise<string>,
      marketContract.getFunction('minLiquidity')() as Promise<bigint>,
    ]);
    const metadata = this.readInlineMetadata(metadataURI);

    await this.markets.registerDiscoveredMarket({
      id: marketAddress.toLowerCase(),
      title: metadata?.title?.trim() || `Market ${marketAddress}`,
      description: metadata?.description,
      categoryId: metadata?.category,
      deadline,
      totalYesStake: 0n,
      totalNoStake: 0n,
      status: 'active',
      chainId,
      factoryAddress,
      factoryAbiVersion: deployment.abiVersion,
      marketAddress,
      creator,
      collateralToken,
      resolutionCriteria: metadata?.resolutionCriteria,
      minLiquidity: minLiquidity.toString(),
      metadataURI,
      creationBlockNumber: log.blockNumber,
      creationTransactionHash: log.transactionHash,
      creationLogIndex: log.index,
    });
  }

  private readInlineMetadata(uri: string): MarketMetadata | undefined {
    const base64Prefix = 'data:application/json;base64,';
    const jsonPrefix = 'data:application/json,';
    try {
      let json: string;
      if (uri.startsWith(base64Prefix)) {
        json = Buffer.from(uri.slice(base64Prefix.length), 'base64').toString('utf8');
      } else if (uri.startsWith(jsonPrefix)) {
        json = decodeURIComponent(uri.slice(jsonPrefix.length));
      } else {
        return undefined;
      }

      const metadata: unknown = JSON.parse(json);
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        this.logger.warn('Skipping inline market metadata that is not a JSON object');
        return undefined;
      }
      const fields = metadata as Record<string, unknown>;
      if (
        fields.resolutionCriteria !== undefined &&
        !isMarketResolutionCriteria(fields.resolutionCriteria)
      ) {
        this.logger.warn(
          'Ignoring invalid inline flight resolution criteria; market will remain unresolved',
        );
      }
      return {
        title: typeof fields.title === 'string' ? fields.title : undefined,
        description:
          typeof fields.description === 'string' ? fields.description : undefined,
        category: typeof fields.category === 'string' ? fields.category : undefined,
        resolutionCriteria: isMarketResolutionCriteria(fields.resolutionCriteria)
          ? fields.resolutionCriteria
          : undefined,
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Unable to parse inline market metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
