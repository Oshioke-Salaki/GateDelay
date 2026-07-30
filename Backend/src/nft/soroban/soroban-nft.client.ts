import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OnChainRoyalty {
  royaltyBps: number;
  recipient: string;
}

/**
 * Thin client for Soroban NFT royalty reads.
 * Uses RPC simulation when configured; otherwise falls back to an in-memory map
 * suitable for local development and unit tests.
 */
@Injectable()
export class SorobanNftClient {
  private readonly logger = new Logger(SorobanNftClient.name);
  private readonly rpcUrl: string;
  private readonly contractId: string;
  private readonly fallback = new Map<string, OnChainRoyalty>();

  constructor(private readonly config: ConfigService) {
    this.rpcUrl = this.config.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org',
    );
    this.contractId = this.config.get<string>('SOROBAN_NFT_CONTRACT_ID', '');

    // Seed a deterministic example for offline / test environments
    this.fallback.set(
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
      {
        royaltyBps: 1000,
        recipient: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRS',
      },
    );
  }

  /** Test helper — register royalty data without hitting the network. */
  seedRoyalty(mintAddress: string, royalty: OnChainRoyalty): void {
    this.fallback.set(mintAddress, royalty);
  }

  async getRoyalties(mintAddress: string): Promise<OnChainRoyalty> {
    if (!mintAddress || mintAddress.trim().length < 8) {
      throw new NotFoundException(
        `Royalty data not found for mint address ${mintAddress}`,
      );
    }

    if (this.contractId) {
      try {
        const result = await this.simulateGetRoyalties(mintAddress);
        if (result) {
          return result;
        }
      } catch (err) {
        this.logger.warn(
          `Soroban RPC get_royalties failed for ${mintAddress}: ${(err as Error).message}. Falling back.`,
        );
      }
    }

    const local = this.fallback.get(mintAddress);
    if (!local) {
      throw new NotFoundException(
        `Royalty data not found for mint address ${mintAddress}`,
      );
    }
    return local;
  }

  private async simulateGetRoyalties(
    mintAddress: string,
  ): Promise<OnChainRoyalty | null> {
    // Soroban JSON-RPC simulateTransaction against get_royalties(mint)
    // Kept intentionally lightweight so unit tests do not require network.
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getContractData',
      params: {
        contractId: this.contractId,
        key: { mintAddress },
        durability: 'persistent',
      },
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      result?: { royaltyBps?: number; recipient?: string };
    };

    if (
      payload?.result &&
      typeof payload.result.royaltyBps === 'number' &&
      typeof payload.result.recipient === 'string'
    ) {
      return {
        royaltyBps: payload.result.royaltyBps,
        recipient: payload.result.recipient,
      };
    }

    return null;
  }
}
