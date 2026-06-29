import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalRecord,
  ApprovalStatus,
  BatchApproval,
} from './approval.entity';
import {
  GenerateApprovalDto,
  ConfirmApprovalDto,
  BatchApprovalDto,
  ApprovalStatusQueryDto,
} from './dto/approval.dto';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly batches = new Map<string, BatchApproval>();
  private readonly provider: ethers.JsonRpcProvider;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  generateApprovalTransaction(
    userId: string,
    dto: GenerateApprovalDto,
  ): { approvalId: string; txData: object; record: ApprovalRecord } {
    const ownerAddress = this.checksumAddress(dto.ownerAddress);
    const spenderAddress = this.checksumAddress(dto.spenderAddress);
    const tokenAddress = this.checksumAddress(dto.tokenAddress);

    let parsedAmount: bigint;
    try {
      parsedAmount = BigInt(dto.amount);
    } catch {
      throw new BadRequestException('Invalid amount: must be a numeric string');
    }

    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData('approve', [
      spenderAddress,
      parsedAmount,
    ]);

    const record: ApprovalRecord = {
      id: uuidv4(),
      userId,
      ownerAddress,
      spenderAddress,
      tokenAddress,
      amount: dto.amount,
      status: 'pending',
      confirmations: 0,
      createdAt: new Date(),
    };

    this.approvals.set(record.id, record);
    this.logger.log(`Generated approval ${record.id} for user ${userId}`);

    return {
      approvalId: record.id,
      txData: {
        to: tokenAddress,
        from: ownerAddress,
        data,
        value: '0x0',
      },
      record,
    };
  }

  async confirmApproval(
    approvalId: string,
    dto: ConfirmApprovalDto,
  ): Promise<ApprovalRecord> {
    const record = this.getApprovalOrThrow(approvalId);

    if (record.status !== 'pending') {
      throw new BadRequestException(
        `Approval ${approvalId} is already ${record.status}`,
      );
    }

    record.txHash = dto.txHash;
    this.approvals.set(approvalId, record);

    this.trackApprovalTransaction(approvalId, dto.txHash).catch((err) =>
      this.logger.error(`Tracking failed for approval ${approvalId}`, err),
    );

    return record;
  }

  async getApprovalStatus(approvalId: string): Promise<ApprovalRecord> {
    const record = this.getApprovalOrThrow(approvalId);

    if (record.txHash && record.status === 'pending') {
      await this.refreshFromChain(record);
    }

    return record;
  }

  getUserApprovals(
    userId: string,
    query: ApprovalStatusQueryDto,
  ): ApprovalRecord[] {
    let results = [...this.approvals.values()].filter(
      (a) => a.userId === userId,
    );

    if (query.status) {
      results = results.filter((a) => a.status === query.status);
    }

    if (query.tokenAddress) {
      const checksummed = this.checksumAddress(query.tokenAddress);
      results = results.filter((a) => a.tokenAddress === checksummed);
    }

    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getAllowance(
    ownerAddress: string,
    spenderAddress: string,
    tokenAddress: string,
  ): Promise<{
    owner: string;
    spender: string;
    token: string;
    allowance: string;
  }> {
    const owner = this.checksumAddress(ownerAddress);
    const spender = this.checksumAddress(spenderAddress);
    const token = this.checksumAddress(tokenAddress);

    try {
      const contract = new ethers.Contract(token, ERC20_ABI, this.provider);
      const raw: bigint = await contract.allowance(owner, spender);
      return { owner, spender, token, allowance: raw.toString() };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Allowance check failed for ${token}`, message);
      throw new BadRequestException(`Failed to fetch allowance: ${message}`);
    }
  }

  async createBatchApproval(
    userId: string,
    dto: BatchApprovalDto,
  ): Promise<{
    batchId: string;
    approvals: Array<{ approvalId: string; txData: object }>;
  }> {
    const ownerAddress = this.checksumAddress(dto.ownerAddress);
    const batchId = uuidv4();
    const approvalResults: Array<{ approvalId: string; txData: object }> = [];

    for (const item of dto.approvals) {
      const result = this.generateApprovalTransaction(userId, {
        ownerAddress,
        spenderAddress: item.spenderAddress,
        tokenAddress: item.tokenAddress,
        amount: item.amount,
      });

      const record = this.approvals.get(result.approvalId)!;
      record.batchId = batchId;
      this.approvals.set(result.approvalId, record);

      approvalResults.push({
        approvalId: result.approvalId,
        txData: result.txData,
      });
    }

    const batch: BatchApproval = {
      id: batchId,
      userId,
      approvalIds: approvalResults.map((r) => r.approvalId),
      status: 'pending',
      createdAt: new Date(),
    };

    this.batches.set(batchId, batch);
    this.logger.log(
      `Created batch ${batchId} with ${dto.approvals.length} approvals for user ${userId}`,
    );

    return { batchId, approvals: approvalResults };
  }

  async getBatchStatus(
    batchId: string,
  ): Promise<BatchApproval & { approvals: ApprovalRecord[] }> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new NotFoundException(`Batch ${batchId} not found`);
    }

    const approvals = batch.approvalIds
      .map((id) => this.approvals.get(id))
      .filter(Boolean) as ApprovalRecord[];

    const confirmed = approvals.filter((a) => a.status === 'confirmed').length;
    const failed = approvals.filter((a) => a.status === 'failed').length;
    const total = approvals.length;

    if (confirmed === total) {
      batch.status = 'complete';
      batch.completedAt = batch.completedAt ?? new Date();
    } else if (failed === total) {
      batch.status = 'failed';
    } else if (confirmed + failed > 0) {
      batch.status = 'partial';
    }

    this.batches.set(batchId, batch);

    return { ...batch, approvals };
  }

  private getApprovalOrThrow(approvalId: string): ApprovalRecord {
    const record = this.approvals.get(approvalId);
    if (!record) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }
    return record;
  }

  private checksumAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      throw new BadRequestException(`Invalid Ethereum address: ${address}`);
    }
  }

  private async refreshFromChain(record: ApprovalRecord): Promise<void> {
    if (!record.txHash) return;

    try {
      const [receipt, currentBlock] = await Promise.all([
        this.provider.getTransactionReceipt(record.txHash),
        this.provider.getBlockNumber(),
      ]);

      if (!receipt) return;

      record.blockNumber = receipt.blockNumber;
      record.confirmations = currentBlock - receipt.blockNumber + 1;

      if (receipt.status === 1) {
        record.status = 'confirmed';
        record.confirmedAt = record.confirmedAt ?? new Date();
      } else {
        record.status = 'failed';
        record.failureReason = 'Transaction reverted on-chain';
      }

      this.approvals.set(record.id, record);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Chain refresh failed for ${record.txHash}: ${message}`);
    }
  }

  private async trackApprovalTransaction(
    approvalId: string,
    txHash: string,
    maxAttempts = 30,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));

      const record = this.approvals.get(approvalId);
      if (!record || record.status !== 'pending') return;

      try {
        const [receipt, currentBlock] = await Promise.all([
          this.provider.getTransactionReceipt(txHash),
          this.provider.getBlockNumber(),
        ]);

        if (!receipt) continue;

        record.blockNumber = receipt.blockNumber;
        record.confirmations = currentBlock - receipt.blockNumber + 1;

        if (receipt.status === 1) {
          record.status = 'confirmed';
          record.confirmedAt = new Date();
          this.logger.log(
            `Approval ${approvalId} confirmed (${record.confirmations} confirmations)`,
          );
        } else {
          record.status = 'failed';
          record.failureReason = 'Transaction reverted on-chain';
          this.logger.warn(`Approval ${approvalId} failed on-chain`);
        }

        this.approvals.set(approvalId, record);
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `Poll attempt ${i + 1} failed for ${txHash}: ${message}`,
        );
      }
    }

    const record = this.approvals.get(approvalId);
    if (record && record.status === 'pending') {
      this.logger.warn(`Approval ${approvalId} tracking timed out`);
    }
  }
}
