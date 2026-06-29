import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import Big from 'big.js';
import {
  BridgeTransaction,
  BridgeTransactionDocument,
  BridgeStatus,
  BridgeProtocol,
} from './schemas/bridge-transaction.schema';
import {
  InitiateBridgeDto,
  UpdateBridgeTxDto,
  GetBridgeTransactionsDto,
} from './dto/bridge.dto';

// ── Protocol configuration ───────────────────────────────────────────────────

interface ProtocolConfig {
  name: string;
  /** Base fee in basis points */
  feeBps: number;
  /** Minimum fee in USD */
  minFeeUsd: number;
  /** Supported chain IDs */
  supportedChainIds: number[];
  /** Average bridge time in seconds */
  avgTimeSeconds: number;
}

const PROTOCOL_CONFIGS: Record<BridgeProtocol, ProtocolConfig> = {
  [BridgeProtocol.STARGATE]: {
    name: 'Stargate',
    feeBps: 6,
    minFeeUsd: 0.5,
    supportedChainIds: [1, 137, 42161, 10, 8453, 5000, 56],
    avgTimeSeconds: 180,
  },
  [BridgeProtocol.ACROSS]: {
    name: 'Across',
    feeBps: 10,
    minFeeUsd: 0.3,
    supportedChainIds: [1, 137, 42161, 10, 8453],
    avgTimeSeconds: 60,
  },
  [BridgeProtocol.HOP]: {
    name: 'Hop Protocol',
    feeBps: 4,
    minFeeUsd: 0.8,
    supportedChainIds: [1, 137, 42161, 10],
    avgTimeSeconds: 480,
  },
  [BridgeProtocol.CBRIDGE]: {
    name: 'cBridge',
    feeBps: 8,
    minFeeUsd: 0.4,
    supportedChainIds: [1, 137, 42161, 10, 8453, 56, 43114],
    avgTimeSeconds: 300,
  },
  [BridgeProtocol.SOCKET]: {
    name: 'Socket',
    feeBps: 5,
    minFeeUsd: 0.6,
    supportedChainIds: [1, 137, 42161, 10, 8453, 5000, 56, 43114],
    avgTimeSeconds: 240,
  },
};

// ── Supported chain metadata ─────────────────────────────────────────────────

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  5000: 'Mantle',
  56: 'BNB Chain',
  43114: 'Avalanche',
};

// ── Analytics result types ───────────────────────────────────────────────────

export interface BridgeAnalytics {
  totalTransactions: number;
  successRate: number;
  totalVolume: string;
  byProtocol: Array<{
    protocol: BridgeProtocol;
    count: number;
    volume: string;
    avgTimeSeconds: number;
  }>;
  byChainPair: Array<{
    fromChainId: number;
    toChainId: number;
    fromChainName: string;
    toChainName: string;
    count: number;
  }>;
  statusBreakdown: Record<BridgeStatus, number>;
}

export interface BridgeRouteQuote {
  protocol: BridgeProtocol;
  protocolName: string;
  estimatedTime: string;
  bridgeFee: string;
  feeBps: number;
  outputAmount: string;
  recommended: boolean;
  supported: boolean;
}

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);

  constructor(
    @InjectModel(BridgeTransaction.name)
    private readonly bridgeTxModel: Model<BridgeTransactionDocument>,
    private readonly configService: ConfigService,
  ) {}

  // ── Route quotes ─────────────────────────────────────────────────────────

  /**
   * Return estimated quotes from all supported protocols for a given route.
   */
  getRouteQuotes(
    fromChainId: number,
    toChainId: number,
    tokenSymbol: string,
    amount: string,
  ): BridgeRouteQuote[] {
    const amountBig = new Big(amount);

    return Object.entries(PROTOCOL_CONFIGS).map(([protocol, config]) => {
      const supported =
        config.supportedChainIds.includes(fromChainId) &&
        config.supportedChainIds.includes(toChainId);

      const feeAmount = amountBig.times(config.feeBps).div(10000);
      const outputAmount = supported
        ? amountBig.minus(feeAmount).toFixed(6)
        : '0';

      const hours = Math.floor(config.avgTimeSeconds / 3600);
      const minutes = Math.floor((config.avgTimeSeconds % 3600) / 60);
      const estimatedTime =
        hours > 0 ? `~${hours}h ${minutes}m` : `~${minutes} min`;

      return {
        protocol: protocol as BridgeProtocol,
        protocolName: config.name,
        estimatedTime,
        bridgeFee: feeAmount.toFixed(6),
        feeBps: config.feeBps,
        outputAmount,
        recommended: protocol === BridgeProtocol.STARGATE,
        supported,
      };
    });
  }

  // ── Initiate bridge transaction ───────────────────────────────────────────

  async initiateTransaction(
    userId: string,
    dto: InitiateBridgeDto,
  ): Promise<BridgeTransactionDocument> {
    // Validate protocol supports the route
    const config = PROTOCOL_CONFIGS[dto.protocol];
    if (
      !config.supportedChainIds.includes(dto.fromChainId) ||
      !config.supportedChainIds.includes(dto.toChainId)
    ) {
      throw new BadRequestException(
        `Protocol ${dto.protocol} does not support the route ` +
          `${dto.fromChainId} → ${dto.toChainId}`,
      );
    }

    if (dto.fromChainId === dto.toChainId) {
      throw new BadRequestException(
        'Source and destination chains must be different',
      );
    }

    // Validate addresses
    try {
      ethers.getAddress(dto.senderAddress);
      ethers.getAddress(dto.recipientAddress);
    } catch {
      throw new BadRequestException('Invalid Ethereum address provided');
    }

    // Validate amount is positive
    const amountBig = new Big(dto.amount);
    if (amountBig.lte(0)) {
      throw new BadRequestException('Bridge amount must be positive');
    }

    // Security: check max fee guard
    const feeAmount = amountBig
      .times(config.feeBps)
      .div(10000)
      .toFixed(6);
    if (dto.maxFeeUsd) {
      const maxFee = new Big(dto.maxFeeUsd);
      // Simple USD approximation: if fee amount > maxFeeUsd (assuming $1/token)
      if (new Big(feeAmount).gt(maxFee)) {
        throw new BadRequestException(
          `Estimated bridge fee (${feeAmount}) exceeds maxFeeUsd (${dto.maxFeeUsd})`,
        );
      }
    }

    // Estimated arrival time
    const estimatedArrivalTime = new Date(
      Date.now() + config.avgTimeSeconds * 1000,
    );

    const tx = await this.bridgeTxModel.create({
      userId,
      protocol: dto.protocol,
      fromChainId: dto.fromChainId,
      toChainId: dto.toChainId,
      fromChainName: CHAIN_NAMES[dto.fromChainId] ?? `Chain ${dto.fromChainId}`,
      toChainName: CHAIN_NAMES[dto.toChainId] ?? `Chain ${dto.toChainId}`,
      tokenSymbol: dto.tokenSymbol,
      tokenAddress: dto.tokenAddress,
      amount: dto.amount,
      senderAddress: ethers.getAddress(dto.senderAddress),
      recipientAddress: ethers.getAddress(dto.recipientAddress),
      slippageBps: dto.slippageBps ?? 50,
      maxFeeUsd: dto.maxFeeUsd ?? '10',
      bridgeFee: feeAmount,
      estimatedArrivalTime,
      status: BridgeStatus.PENDING,
    });

    this.logger.log(
      `Bridge initiated: ${tx.id} | ${dto.amount} ${dto.tokenSymbol} ` +
        `via ${dto.protocol} from chain ${dto.fromChainId} → ${dto.toChainId}`,
    );

    return tx;
  }

  // ── Update transaction ────────────────────────────────────────────────────

  async updateTransaction(
    transactionId: string,
    dto: UpdateBridgeTxDto,
  ): Promise<BridgeTransactionDocument> {
    const tx = await this.bridgeTxModel.findById(transactionId);
    if (!tx) throw new NotFoundException('Bridge transaction not found');

    if (dto.status) tx.status = dto.status;
    if (dto.sourceTxHash) tx.sourceTxHash = dto.sourceTxHash;
    if (dto.destinationTxHash) tx.destinationTxHash = dto.destinationTxHash;
    if (dto.bridgeTransferId) tx.bridgeTransferId = dto.bridgeTransferId;
    if (dto.sourceConfirmations !== undefined)
      tx.sourceConfirmations = dto.sourceConfirmations;
    if (dto.destinationConfirmations !== undefined)
      tx.destinationConfirmations = dto.destinationConfirmations;
    if (dto.receivedAmount) tx.receivedAmount = dto.receivedAmount;
    if (dto.errorMessage) tx.errorMessage = dto.errorMessage;

    // Stamp completion / failure times
    if (dto.status === BridgeStatus.COMPLETED && !tx.completedAt) {
      tx.completedAt = new Date();
    }
    if (dto.status === BridgeStatus.FAILED && !tx.failedAt) {
      tx.failedAt = new Date();
    }
    if (dto.status === BridgeStatus.REFUNDED && !tx.refundedAt) {
      tx.refundedAt = new Date();
    }

    await tx.save();

    this.logger.log(
      `Bridge tx ${transactionId} updated to status: ${dto.status ?? 'unchanged'}`,
    );

    return tx;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  async getTransactionById(
    transactionId: string,
  ): Promise<BridgeTransactionDocument> {
    const tx = await this.bridgeTxModel.findById(transactionId);
    if (!tx) throw new NotFoundException('Bridge transaction not found');
    return tx;
  }

  async getTransactionBySourceHash(
    sourceTxHash: string,
  ): Promise<BridgeTransactionDocument> {
    const tx = await this.bridgeTxModel.findOne({ sourceTxHash });
    if (!tx)
      throw new NotFoundException(
        'Bridge transaction not found for the given source hash',
      );
    return tx;
  }

  async getTransactions(dto: GetBridgeTransactionsDto): Promise<{
    transactions: BridgeTransactionDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (dto.userId) filter.userId = dto.userId;
    if (dto.status) filter.status = dto.status;
    if (dto.protocol) filter.protocol = dto.protocol;
    if (dto.fromChainId) filter.fromChainId = dto.fromChainId;
    if (dto.toChainId) filter.toChainId = dto.toChainId;

    const [transactions, total] = await Promise.all([
      this.bridgeTxModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bridgeTxModel.countDocuments(filter),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Status tracking ───────────────────────────────────────────────────────

  /**
   * Returns all in-flight transactions (pending / approving / bridging / confirming)
   * that have passed their estimated arrival time — used for polling / alerting.
   */
  async getStaleTransactions(): Promise<BridgeTransactionDocument[]> {
    return this.bridgeTxModel
      .find({
        status: {
          $in: [
            BridgeStatus.PENDING,
            BridgeStatus.APPROVING,
            BridgeStatus.BRIDGING,
            BridgeStatus.CONFIRMING,
          ],
        },
        estimatedArrivalTime: { $lt: new Date() },
      })
      .exec();
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(userId?: string): Promise<BridgeAnalytics> {
    const matchStage = userId ? { $match: { userId } } : { $match: {} };

    const [totalTxs, statusAgg, protocolAgg, chainPairAgg] =
      await Promise.all([
        this.bridgeTxModel.countDocuments(userId ? { userId } : {}),

        // Status breakdown
        this.bridgeTxModel.aggregate([
          matchStage,
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // By protocol
        this.bridgeTxModel.aggregate([
          matchStage,
          {
            $group: {
              _id: '$protocol',
              count: { $sum: 1 },
              totalVolume: { $sum: { $toDouble: '$amount' } },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // By chain pair
        this.bridgeTxModel.aggregate([
          matchStage,
          {
            $group: {
              _id: {
                fromChainId: '$fromChainId',
                toChainId: '$toChainId',
                fromChainName: '$fromChainName',
                toChainName: '$toChainName',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    const statusMap = statusAgg.reduce(
      (acc: Record<string, number>, { _id, count }: { _id: string; count: number }) => {
        acc[_id] = count;
        return acc;
      },
      {},
    );

    const completedCount = statusMap[BridgeStatus.COMPLETED] ?? 0;
    const successRate = totalTxs > 0 ? (completedCount / totalTxs) * 100 : 0;

    const totalVolume = protocolAgg.reduce(
      (sum: Big, p: { totalVolume: number }) => sum.plus(p.totalVolume ?? 0),
      new Big(0),
    );

    return {
      totalTransactions: totalTxs,
      successRate: parseFloat(successRate.toFixed(2)),
      totalVolume: totalVolume.toFixed(6),
      byProtocol: protocolAgg.map(
        (p: { _id: BridgeProtocol; count: number; totalVolume: number }) => ({
          protocol: p._id,
          count: p.count,
          volume: p.totalVolume?.toFixed(6) ?? '0',
          avgTimeSeconds: PROTOCOL_CONFIGS[p._id]?.avgTimeSeconds ?? 0,
        }),
      ),
      byChainPair: chainPairAgg.map(
        (p: {
          _id: {
            fromChainId: number;
            toChainId: number;
            fromChainName: string;
            toChainName: string;
          };
          count: number;
        }) => ({
          fromChainId: p._id.fromChainId,
          toChainId: p._id.toChainId,
          fromChainName: p._id.fromChainName,
          toChainName: p._id.toChainName,
          count: p.count,
        }),
      ),
      statusBreakdown: Object.values(BridgeStatus).reduce(
        (acc, s) => {
          acc[s] = statusMap[s] ?? 0;
          return acc;
        },
        {} as Record<BridgeStatus, number>,
      ),
    };
  }

  // ── Security helpers ──────────────────────────────────────────────────────

  /**
   * Validate that a given address is a permitted bridge contract.
   * In production this would check against a registry; here it validates format.
   */
  validateBridgeAddress(address: string): boolean {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get protocol information for the client.
   */
  getProtocolInfo(): ProtocolConfig & { protocol: BridgeProtocol }[] {
    return Object.entries(PROTOCOL_CONFIGS).map(([protocol, config]) => ({
      protocol: protocol as BridgeProtocol,
      ...config,
    }));
  }
}
