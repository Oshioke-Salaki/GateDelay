import { Injectable, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';

export interface SignedRequest {
  nonce: string;
  timestamp: number;
  signature: string;
  signer: string;
  payload: Record<string, unknown>;
}

export interface ReplayProtectionConfig {
  maxTimestampDriftMs: number;
  nonceTtlMs: number;
}

const DEFAULT_CONFIG: ReplayProtectionConfig = {
  maxTimestampDriftMs: 5 * 60 * 1000,
  nonceTtlMs: 24 * 60 * 60 * 1000,
};

@Injectable()
export class ReplayProtectionService {
  private readonly config: ReplayProtectionConfig;
  private readonly usedNonces = new Map<string, number>();

  constructor(config?: Partial<ReplayProtectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    setInterval(() => this.cleanupExpiredNonces(), 60 * 60 * 1000);
  }

  private cleanupExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > this.config.nonceTtlMs) {
        this.usedNonces.delete(nonce);
      }
    }
  }

  generateNonce(): string {
    return ethers.id(`${Date.now()}-${Math.random()}`);
  }

  async verifyRequest(request: SignedRequest): Promise<{
    valid: boolean;
    recoveredSigner?: string;
    error?: string;
  }> {
    const { nonce, timestamp, signature, signer, payload } = request;

    if (!nonce || typeof nonce !== 'string') {
      return { valid: false, error: 'Missing or invalid nonce' };
    }

    if (this.usedNonces.has(nonce)) {
      return { valid: false, error: 'Nonce already used (replay detected)' };
    }

    if (!timestamp || typeof timestamp !== 'number') {
      return { valid: false, error: 'Missing or invalid timestamp' };
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > this.config.maxTimestampDriftMs) {
      return {
        valid: false,
        error: `Timestamp drift exceeds ${this.config.maxTimestampDriftMs}ms`,
      };
    }

    if (!signature || typeof signature !== 'string') {
      return { valid: false, error: 'Missing or invalid signature' };
    }

    if (!signer || typeof signer !== 'string') {
      return { valid: false, error: 'Missing or invalid signer' };
    }

    const message = this.createMessage(payload, nonce, timestamp);
    let recoveredSigner: string;

    try {
      recoveredSigner = ethers.verifyMessage(message, signature);
    } catch {
      return { valid: false, error: 'Invalid signature format' };
    }

    if (ethers.getAddress(recoveredSigner) !== ethers.getAddress(signer)) {
      return { valid: false, error: 'Signature signer mismatch' };
    }

    this.usedNonces.set(nonce, timestamp);

    return { valid: true, recoveredSigner };
  }

  private createMessage(
    payload: Record<string, unknown>,
    nonce: string,
    timestamp: number,
  ): string {
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {} as Record<string, unknown>);

    return JSON.stringify({
      payload: sortedPayload,
      nonce,
      timestamp,
    });
  }

  isNonceUsed(nonce: string): boolean {
    return this.usedNonces.has(nonce);
  }

  markNonceUsed(nonce: string): void {
    this.usedNonces.set(nonce, Date.now());
  }

  getConfig(): ReplayProtectionConfig {
    return { ...this.config };
  }
}

export const createReplayProtectionMiddleware = (
  replayProtectionService: ReplayProtectionService,
) => {
  return async (req: any, res: any, next: any) => {
    try {
      const { nonce, timestamp, signature, signer, payload } = req.body;

      if (!nonce || !timestamp || !signature || !signer || !payload) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: nonce, timestamp, signature, signer, payload',
          code: 'REPLAY_PROTECTION_INVALID_REQUEST',
        });
      }

      const result = await replayProtectionService.verifyRequest({
        nonce,
        timestamp,
        signature,
        signer,
        payload,
      });

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: result.error,
          code: 'REPLAY_PROTECTION_FAILED',
        });
      }

      req.replayProtection = {
        verified: true,
        signer: result.recoveredSigner,
        nonce,
      };

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Replay protection verification failed',
        code: 'REPLAY_PROTECTION_ERROR',
      });
    }
  };
};