import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ConnectWalletDto } from './dto/wallet.dto';
import { WalletOwnership, WalletDocument } from './wallet.schema';
import { ReplayProtectionService } from '../common/services/replay-protection.service';

export interface WalletEntry {
  address: string; // checksummed
  userId: string;
  connectedAt: Date;
  network: string;
}

export interface BalanceResult {
  address: string;
  network: string;
  balanceWei: string;
  balanceEth: string;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly provider: ethers.JsonRpcProvider;

  constructor(
    @InjectModel(WalletOwnership.name)
    private readonly walletModel: Model<WalletDocument>,
    private readonly config: ConfigService,
    private readonly replayProtection: ReplayProtectionService,
  ) {
    const rpcUrl = this.config.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async connectWallet(
    userId: string,
    dto: ConnectWalletDto,
  ): Promise<WalletEntry> {
    const checksummed = this.validateAddress(dto.address);

    if (!dto.nonce || !dto.timestamp) {
      throw new BadRequestException(
        'Wallet connection requires nonce and timestamp for replay protection',
      );
    }

    const result = await this.replayProtection.verifyRequest({
      nonce: dto.nonce,
      timestamp: dto.timestamp,
      signature: dto.signature,
      signer: checksummed,
      payload: { address: checksummed, message: dto.message },
    });

    if (!result.valid) {
      throw new BadRequestException(
        `Replay protection failed: ${result.error}`,
      );
    }

    const existing = await this.walletModel
      .findOne({ address: checksummed })
      .lean()
      .exec();

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          'Wallet already connected to another account',
        );
      }
      return this.toEntry(existing);
    }

    try {
      const doc = await this.walletModel.create({
        address: checksummed,
        userId,
        connectedAt: new Date(),
        network: this.config.get<string>('BLOCKCHAIN_RPC_URL', 'mantle'),
      });
      this.logger.log(`Wallet ${checksummed} connected to user ${userId}`);
      return this.toEntry(doc);
    } catch (err: any) {
      // Duplicate key — another instance raced us
      if (err?.code === 11000) {
        const raced = await this.walletModel
          .findOne({ address: checksummed })
          .lean()
          .exec();
        if (raced && raced.userId !== userId) {
          throw new ConflictException(
            'Wallet already connected to another account',
          );
        }
        if (raced) return this.toEntry(raced);
      }
      throw err;
    }
  }

  async getUserWallets(userId: string): Promise<WalletEntry[]> {
    const docs = await this.walletModel
      .find({ userId })
      .lean()
      .exec();
    return docs.map((d) => this.toEntry(d));
  }

  async getBalance(address: string): Promise<BalanceResult> {
    const checksummed = this.validateAddress(address);
    try {
      const raw = await this.provider.getBalance(checksummed);
      return {
        address: checksummed,
        network: this.config.get<string>('BLOCKCHAIN_RPC_URL', 'mantle'),
        balanceWei: raw.toString(),
        balanceEth: ethers.formatEther(raw),
      };
    } catch (err) {
      this.logger.error(`Failed to fetch balance for ${checksummed}`, err);
      throw new BadRequestException(
        'Unable to retrieve balance — check RPC connectivity',
      );
    }
  }

  async disconnectWallet(userId: string, address: string): Promise<void> {
    const checksummed = this.validateAddress(address);
    const result = await this.walletModel
      .deleteOne({ address: checksummed, userId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Wallet not found for this user');
    }
    this.logger.log(`Wallet ${checksummed} disconnected from user ${userId}`);
  }

  async registerRecoveredWallet(
    userId: string,
    address: string,
  ): Promise<WalletEntry> {
    const checksummed = this.validateAddress(address);

    const existing = await this.walletModel
      .findOne({ address: checksummed })
      .lean()
      .exec();

    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          'Wallet already connected to another account',
        );
      }
      return this.toEntry(existing);
    }

    try {
      const doc = await this.walletModel.create({
        address: checksummed,
        userId,
        connectedAt: new Date(),
        network: this.config.get<string>('BLOCKCHAIN_RPC_URL', 'mantle'),
      });
      this.logger.log(`Wallet ${checksummed} recovered for user ${userId}`);
      return this.toEntry(doc);
    } catch (err: any) {
      if (err?.code === 11000) {
        const raced = await this.walletModel
          .findOne({ address: checksummed })
          .lean()
          .exec();
        if (raced && raced.userId !== userId) {
          throw new ConflictException(
            'Wallet already connected to another account',
          );
        }
        if (raced) return this.toEntry(raced);
      }
      throw err;
    }
  }

  generateChallenge(): string {
    return this.replayProtection.generateNonce();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private validateAddress(raw: string): string {
    try {
      return ethers.getAddress(raw);
    } catch {
      throw new BadRequestException(`Invalid Ethereum address: ${raw}`);
    }
  }

  private toEntry(doc: Partial<WalletOwnership>): WalletEntry {
    return {
      address: doc.address!,
      userId: doc.userId!,
      connectedAt: doc.connectedAt!,
      network: doc.network!,
    };
  }
}
