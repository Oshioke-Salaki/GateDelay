import { Injectable, BadRequestException, Logger, Optional, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import Redis from 'ioredis';

export const REPLAY_PROTECTION_REDIS = 'REPLAY_PROTECTION_REDIS';

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

const NONCE_KEY_PREFIX = 'replay:nonce:';

/**
 * Durable, shared replay-protection store.
 *
 * Nonces are consumed atomically via Redis SET NX EX so that:
 *  - concurrent replay attempts on any instance are rejected deterministically;
 *  - a process restart cannot re-accept a nonce that was already consumed.
 *
 * When Redis is unreachable the service degrades to a process-local Map and
 * logs a loud warning — single-instance correctness is preserved, but
 * cross-instance replay protection is lost until Redis recovers.
 *
 * Closes #1396
 */
@Injectable()
export class ReplayProtectionService {
  private readonly logger = new Logger(ReplayProtectionService.name);
  private readonly config: ReplayProtectionConfig;

  /** Fallback used only when Redis is unavailable. */
  private readonly memoryNonces = new Map<string, number>();
  private usingMemoryFallback = false;

  constructor(
    @Optional() @Inject(REPLAY_PROTECTION_REDIS) private readonly redis: Redis | null,
    config?: Partial<ReplayProtectionConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.redis) {
      this.logger.warn(
        '[ReplayProtection] No Redis client injected — falling back to in-process nonce store. ' +
          'Replay protection will NOT survive restarts or span multiple instances.',
      );
      this.usingMemoryFallback = true;
      this.startMemoryCleanup();
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

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

    // Atomically consume the nonce — reject if already seen.
    const consumed = await this.consumeNonce(nonce);
    if (!consumed) {
      return { valid: false, error: 'Nonce already used (replay detected)' };
    }

    return { valid: true, recoveredSigner };
  }

  /** Check without consuming — for read-only inspection in tests / admin. */
  async isNonceUsed(nonce: string): Promise<boolean> {
    if (this.redis && !this.usingMemoryFallback) {
      try {
        const val = await this.redis.get(`${NONCE_KEY_PREFIX}${nonce}`);
        return val !== null;
      } catch (err) {
        this.logger.warn(`[ReplayProtection] Redis GET failed: ${(err as Error).message}`);
      }
    }
    return this.memoryNonces.has(nonce);
  }

  getConfig(): ReplayProtectionConfig {
    return { ...this.config };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Atomically mark a nonce as used.
   * Returns true if the nonce was fresh (first use), false if already consumed.
   *
   * Redis: SET key 1 NX EX <ttlSeconds>  — O(1), atomic.
   * Memory fallback: Map.has + Map.set inside synchronous JS event loop.
   */
  private async consumeNonce(nonce: string): Promise<boolean> {
    const ttlSeconds = Math.ceil(this.config.nonceTtlMs / 1000);

    if (this.redis && !this.usingMemoryFallback) {
      try {
        const result = await this.redis.set(
          `${NONCE_KEY_PREFIX}${nonce}`,
          '1',
          'EX',
          ttlSeconds,
          'NX',
        );
        // SET NX returns 'OK' on success, null when the key already exists.
        return result === 'OK';
      } catch (err) {
        this.logger.error(
          `[ReplayProtection] Redis SET NX failed, falling back to memory: ${(err as Error).message}`,
        );
        this.usingMemoryFallback = true;
        this.startMemoryCleanup();
      }
    }

    // Memory fallback — single-instance only.
    if (this.memoryNonces.has(nonce)) {
      return false;
    }
    this.memoryNonces.set(nonce, Date.now());
    return true;
  }

  private createMessage(
    payload: Record<string, unknown>,
    nonce: string,
    timestamp: number,
  ): string {
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = payload[key];
          return acc;
        },
        {} as Record<string, unknown>,
      );

    return JSON.stringify({ payload: sortedPayload, nonce, timestamp });
  }

  private startMemoryCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.config.nonceTtlMs;
      for (const [nonce, ts] of this.memoryNonces.entries()) {
        if (ts < cutoff) this.memoryNonces.delete(nonce);
      }
    }, 60 * 60 * 1000);
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
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Replay protection verification failed',
        code: 'REPLAY_PROTECTION_ERROR',
      });
    }
  };
};
