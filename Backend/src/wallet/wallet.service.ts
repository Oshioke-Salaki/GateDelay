import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ConnectWalletDto } from './dto/wallet.dto';

export interface WalletEntry {
  address: string;          // checksummed
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

  /** userId → Set<checksummedAddress> */
  private readonly userWallets = new Map<string, Set<string>>();
  /** checksummedAddress → WalletEntry */
  private readonly walletRegistry = new Map<string, WalletEntry>();

  private readonly provider: ethers.JsonRpcProvider;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('BLOCKCHAIN_RPC_URL', 'https://rpc.mantle.xyz');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async connectWallet(userId: string, dto: ConnectWalletDto): Promise<WalletEntry> {
    const checksummed = this.validateAddress(dto.address);
    this.verifySignature(checksummed, dto.message, dto.signature);

    if (this.walletRegistry.has(checksummed)) {
      const existing = this.walletRegistry.get(checksummed)!;
      if (existing.userId !== userId) {
        throw new ConflictException('Wallet already connected to another account');
      }
      return existing; // idempotent re-connect
    }

    const entry: WalletEntry = {
      address: checksummed,
      userId,
      connectedAt: new Date(),
      network: this.config.get<string>('BLOCKCHAIN_RPC_URL', 'mantle'),
    };

    this.walletRegistry.set(checksummed, entry);
    if (!this.userWallets.has(userId)) this.userWallets.set(userId, new Set());
    this.userWallets.get(userId)!.add(checksummed);

    this.logger.log(`Wallet ${checksummed} connected to user ${userId}`);
    return entry;
  }

  getUserWallets(userId: string): WalletEntry[] {
    const addresses = this.userWallets.get(userId) ?? new Set<string>();
    return Array.from(addresses)
      .map((a) => this.walletRegistry.get(a))
      .filter(Boolean) as WalletEntry[];
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
      throw new BadRequestException('Unable to retrieve balance — check RPC connectivity');
    }
  }

  disconnectWallet(userId: string, address: string): void {
    const checksummed = this.validateAddress(address);
    const entry = this.walletRegistry.get(checksummed);
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Wallet not found for this user');
    }
    this.walletRegistry.delete(checksummed);
    this.userWallets.get(userId)?.delete(checksummed);
    this.logger.log(`Wallet ${checksummed} disconnected from user ${userId}`);
  }

  async registerRecoveredWallet(userId: string, address: string): Promise<WalletEntry> {
    const checksummed = this.validateAddress(address);

    if (this.walletRegistry.has(checksummed)) {
      const existing = this.walletRegistry.get(checksummed)!;
      if (existing.userId !== userId) {
        throw new ConflictException('Wallet already connected to another account');
      }
      return existing;
    }

    const entry: WalletEntry = {
      address: checksummed,
      userId,
      connectedAt: new Date(),
      network: this.config.get<string>('BLOCKCHAIN_RPC_URL', 'mantle'),
    };

    this.walletRegistry.set(checksummed, entry);
    if (!this.userWallets.has(userId)) this.userWallets.set(userId, new Set());
    this.userWallets.get(userId)!.add(checksummed);

    this.logger.log(`Wallet ${checksummed} recovered for user ${userId}`);
    return entry;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private validateAddress(raw: string): string {
    try {
      return ethers.getAddress(raw);
    } catch {
      throw new BadRequestException(`Invalid Ethereum address: ${raw}`);
    }
  }

  private verifySignature(address: string, message: string, signature: string): void {
    try {
      const recovered = ethers.verifyMessage(message, signature);
      if (ethers.getAddress(recovered) !== address) {
        throw new Error('Signer mismatch');
      }
    } catch {
      throw new BadRequestException('Signature verification failed');
    }
  }
}
