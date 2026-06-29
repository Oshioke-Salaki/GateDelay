import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import Redis from 'ioredis';
import { Deposit, DepositDocument, DepositStatus, ConfirmationLevel } from './schemas/deposit.schema';
import { CreateDepositDto, GetDepositsDto, DepositResponseDto } from './dto/deposit.dto';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly DEPOSIT_EXPIRY_HOURS = 24;

  constructor(
    @InjectModel(Deposit.name) private depositModel: Model<DepositDocument>,
    private readonly configService: ConfigService,
  ) {
    const rpcUrl = this.configService.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
  }

  /**
   * Create a new deposit record
   */
  async createDeposit(dto: CreateDepositDto): Promise<DepositResponseDto> {
    // Check if deposit already exists
    const existing = await this.depositModel.findOne({ txHash: dto.txHash });
    if (existing) {
      throw new BadRequestException('Deposit with this transaction hash already exists');
    }

    // Verify transaction exists on blockchain
    const tx = await this.provider.getTransaction(dto.txHash).catch(() => null);
    if (!tx) {
      throw new BadRequestException('Transaction not found on blockchain');
    }

    // Validate addresses match
    if (tx.from.toLowerCase() !== dto.fromAddress.toLowerCase()) {
      throw new BadRequestException('From address does not match transaction');
    }

    if (tx.to && tx.to.toLowerCase() !== dto.toAddress.toLowerCase()) {
      throw new BadRequestException('To address does not match transaction');
    }

    // Set expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.DEPOSIT_EXPIRY_HOURS);

    const deposit = new this.depositModel({
      ...dto,
      requiredConfirmations: dto.requiredConfirmations ?? ConfirmationLevel.STANDARD,
      expiresAt,
    });

    await deposit.save();

    this.logger.log(`Created deposit ${deposit.id} for user ${dto.userId}, tx: ${dto.txHash}`);

    // Cache the deposit
    await this.cacheDeposit(deposit);

    return this.toResponseDto(deposit);
  }

  /**
   * Get deposit by ID
   */
  async getDepositById(id: string): Promise<DepositResponseDto> {
    // Try cache first
    const cached = await this.getCachedDeposit(id);
    if (cached) {
      return cached;
    }

    const deposit = await this.depositModel.findById(id);
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    const response = this.toResponseDto(deposit);
    await this.cacheDeposit(deposit);

    return response;
  }

  /**
   * Get deposit by transaction hash
   */
  async getDepositByTxHash(txHash: string): Promise<DepositResponseDto> {
    const deposit = await this.depositModel.findOne({ txHash });
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    return this.toResponseDto(deposit);
  }

  /**
   * Get deposits with filters
   */
  async getDeposits(dto: GetDepositsDto): Promise<{
    deposits: DepositResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { userId, status, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const [deposits, total] = await Promise.all([
      this.depositModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.depositModel.countDocuments(filter),
    ]);

    return {
      deposits: deposits.map((d) => this.toResponseDto(d)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get pending deposits for monitoring
   */
  async getPendingDeposits(): Promise<DepositDocument[]> {
    return this.depositModel
      .find({
        status: { $in: [DepositStatus.PENDING, DepositStatus.CONFIRMING] },
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /**
   * Update deposit confirmations
   */
  async updateConfirmations(
    depositId: string,
    confirmations: number,
    blockNumber?: number,
    blockHash?: string,
  ): Promise<void> {
    const deposit = await this.depositModel.findById(depositId);
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    deposit.confirmations = confirmations;
    if (blockNumber) deposit.blockNumber = blockNumber;
    if (blockHash) deposit.blockHash = blockHash;

    // Update status based on confirmations
    if (confirmations > 0 && deposit.status === DepositStatus.PENDING) {
      deposit.status = DepositStatus.CONFIRMING;
    }

    if (confirmations >= deposit.requiredConfirmations) {
      deposit.status = DepositStatus.CONFIRMED;
      deposit.confirmedAt = new Date();
    }

    await deposit.save();

    // Invalidate cache
    await this.invalidateCache(depositId);

    this.logger.log(
      `Updated deposit ${depositId}: ${confirmations}/${deposit.requiredConfirmations} confirmations`,
    );
  }

  /**
   * Mark deposit as confirmed
   */
  async confirmDeposit(depositId: string): Promise<void> {
    const deposit = await this.depositModel.findById(depositId);
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status === DepositStatus.CONFIRMED) {
      return; // Already confirmed
    }

    deposit.status = DepositStatus.CONFIRMED;
    deposit.confirmedAt = new Date();
    await deposit.save();

    await this.invalidateCache(depositId);

    this.logger.log(`Confirmed deposit ${depositId}`);
  }

  /**
   * Mark deposit as failed
   */
  async failDeposit(depositId: string, errorMessage: string): Promise<void> {
    const deposit = await this.depositModel.findById(depositId);
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    deposit.status = DepositStatus.FAILED;
    deposit.failedAt = new Date();
    deposit.errorMessage = errorMessage;
    await deposit.save();

    await this.invalidateCache(depositId);

    this.logger.error(`Failed deposit ${depositId}: ${errorMessage}`);
  }

  /**
   * Mark balance as updated
   */
  async markBalanceUpdated(depositId: string): Promise<void> {
    await this.depositModel.findByIdAndUpdate(depositId, {
      balanceUpdated: true,
    });

    await this.invalidateCache(depositId);
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(depositId: string): Promise<void> {
    await this.depositModel.findByIdAndUpdate(depositId, {
      notificationSent: true,
    });

    await this.invalidateCache(depositId);
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(txHash: string): Promise<{
    confirmations: number;
    blockNumber?: number;
    blockHash?: string;
    status?: number;
  }> {
    try {
      const [receipt, tx, currentBlock] = await Promise.all([
        this.provider.getTransactionReceipt(txHash),
        this.provider.getTransaction(txHash),
        this.provider.getBlockNumber(),
      ]);

      if (!tx) {
        return { confirmations: 0 };
      }

      const confirmations = receipt ? currentBlock - receipt.blockNumber + 1 : 0;

      return {
        confirmations,
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        status: receipt?.status,
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction details for ${txHash}`, error);
      return { confirmations: 0 };
    }
  }

  /**
   * Expire old pending deposits
   */
  async expireOldDeposits(): Promise<number> {
    const result = await this.depositModel.updateMany(
      {
        status: { $in: [DepositStatus.PENDING, DepositStatus.CONFIRMING] },
        expiresAt: { $lt: new Date() },
      },
      {
        status: DepositStatus.EXPIRED,
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`Expired ${result.modifiedCount} old deposits`);
    }

    return result.modifiedCount;
  }

  /**
   * Get deposit statistics
   */
  async getStatistics(userId?: string): Promise<{
    total: number;
    pending: number;
    confirming: number;
    confirmed: number;
    failed: number;
    totalAmount: string;
  }> {
    const filter = userId ? { userId } : {};

    const [stats, totalAmount] = await Promise.all([
      this.depositModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.depositModel.aggregate([
        { $match: { ...filter, status: DepositStatus.CONFIRMED } },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: '$amount' } },
          },
        },
      ]),
    ]);

    const statusCounts = stats.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: stats.reduce((sum, item) => sum + item.count, 0),
      pending: statusCounts[DepositStatus.PENDING] || 0,
      confirming: statusCounts[DepositStatus.CONFIRMING] || 0,
      confirmed: statusCounts[DepositStatus.CONFIRMED] || 0,
      failed: statusCounts[DepositStatus.FAILED] || 0,
      totalAmount: totalAmount[0]?.total?.toString() || '0',
    };
  }

  // Private helper methods

  private toResponseDto(deposit: DepositDocument): DepositResponseDto {
    return {
      id: deposit.id,
      userId: deposit.userId,
      txHash: deposit.txHash,
      fromAddress: deposit.fromAddress,
      toAddress: deposit.toAddress,
      amount: deposit.amount,
      currency: deposit.currency,
      network: deposit.network,
      status: deposit.status,
      confirmations: deposit.confirmations,
      requiredConfirmations: deposit.requiredConfirmations,
      blockNumber: deposit.blockNumber,
      balanceUpdated: deposit.balanceUpdated,
      notificationSent: deposit.notificationSent,
      confirmedAt: deposit.confirmedAt,
      createdAt: deposit.createdAt,
      updatedAt: deposit.updatedAt,
    };
  }

  private async cacheDeposit(deposit: DepositDocument): Promise<void> {
    const key = `deposit:${deposit.id}`;
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(this.toResponseDto(deposit)));
  }

  private async getCachedDeposit(id: string): Promise<DepositResponseDto | null> {
    const key = `deposit:${id}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async invalidateCache(id: string): Promise<void> {
    const key = `deposit:${id}`;
    await this.redis.del(key);
  }
}
