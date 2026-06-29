import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BroadcastTransactionDto } from './dto/transaction.dto';

export interface TransactionRecord {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  from?: string;
  to?: string;
  value?: string;
  submittedAt: Date;
  confirmedAt?: Date;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly transactions = new Map<string, TransactionRecord>();

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async broadcastTransaction(dto: BroadcastTransactionDto) {
    this.validateSignedTransaction(dto.signedTransaction);

    let txHash: string;
    try {
      const response = await this.provider.broadcastTransaction(
        dto.signedTransaction,
      );
      txHash = response.hash;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('Broadcast failed', message);
      throw new BadRequestException(`Broadcast failed: ${message}`);
    }

    const record: TransactionRecord = {
      txHash,
      status: 'pending',
      confirmations: 0,
      submittedAt: new Date(),
    };
    this.transactions.set(txHash, record);

    // Track confirmations asynchronously
    this.trackTransaction(txHash).catch((err) =>
      this.logger.error(`Tracking failed for ${txHash}`, err),
    );

    return { txHash, status: 'pending' };
  }

  async getTransactionStatus(txHash: string) {
    const cached = this.transactions.get(txHash);

    try {
      const [receipt, tx] = await Promise.all([
        this.provider.getTransactionReceipt(txHash),
        this.provider.getTransaction(txHash),
      ]);

      if (!tx) {
        return cached ?? { txHash, status: 'not_found' };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = receipt
        ? currentBlock - receipt.blockNumber + 1
        : 0;
      const status = !receipt
        ? 'pending'
        : receipt.status === 1
          ? 'confirmed'
          : 'failed';

      const record: TransactionRecord = {
        txHash,
        status,
        confirmations,
        blockNumber: receipt?.blockNumber,
        from: tx.from,
        to: tx.to ?? undefined,
        value: tx.value.toString(),
        submittedAt: cached?.submittedAt ?? new Date(),
        confirmedAt: receipt && status === 'confirmed' ? new Date() : undefined,
      };
      this.transactions.set(txHash, record);
      return record;
    } catch (err) {
      this.logger.error(`Failed to get status for ${txHash}`, err);
      return cached ?? { txHash, status: 'unknown' };
    }
  }

  private validateSignedTransaction(signedTx: string) {
    try {
      ethers.Transaction.from(signedTx);
    } catch {
      throw new BadRequestException('Invalid signed transaction');
    }
  }

  private async trackTransaction(txHash: string, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000)); // poll every 5s
      const record = this.transactions.get(txHash);
      if (!record || record.status !== 'pending') return;

      const receipt = await this.provider
        .getTransactionReceipt(txHash)
        .catch(() => null);
      if (receipt) {
        const currentBlock = await this.provider.getBlockNumber();
        record.confirmations = currentBlock - receipt.blockNumber + 1;
        record.blockNumber = receipt.blockNumber;
        record.status = receipt.status === 1 ? 'confirmed' : 'failed';
        if (record.status === 'confirmed') record.confirmedAt = new Date();
        this.logger.log(
          `Tx ${txHash} ${record.status} (${record.confirmations} confirmations)`,
        );
        return;
      }
    }
    this.logger.warn(`Tx ${txHash} tracking timed out`);
  }
}
