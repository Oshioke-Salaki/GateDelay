import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
import {
  GapFillResult,
  NonceReservation,
  NonceState,
  ReserveNonceResult,
} from './models/nonce.model';
import { resolveChain, type ChainEntry } from './chain-registry';

// ── Distributed lock constants ─────────────────────────────────────────────────

/**
 * How long (ms) a lock lease lives in the cache store before it is
 * automatically expired.  Keeps a crashed holder from blocking forever.
 */
const LOCK_TTL_MS = 10_000;

/**
 * How long to wait between CAS spin attempts (ms).
 */
const LOCK_RETRY_INTERVAL_MS = 50;

/**
 * Maximum total time (ms) to spin waiting for a lock before giving up.
 * Callers see a ConflictException if this is exceeded.
 */
const LOCK_ACQUIRE_TIMEOUT_MS = 8_000;

const DEFAULT_NETWORK = 'mantle';
const DEFAULT_RESERVATION_TTL_MS = 30_000;

@Injectable()
export class NonceManagerService {
  private readonly providerCache = new Map<number, ethers.JsonRpcProvider>();

  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getNonceState(
    address: string,
    network = DEFAULT_NETWORK,
  ): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);
      await this.persistState(state);
      return state;
    });
  }

  async reserveNonce(
    address: string,
    network = DEFAULT_NETWORK,
    ttlMs = DEFAULT_RESERVATION_TTL_MS,
  ): Promise<ReserveNonceResult> {
    if (!Number.isInteger(ttlMs) || ttlMs < 1000) {
      throw new BadRequestException(
        'ttlMs must be an integer greater than or equal to 1000',
      );
    }

    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);

      const nonce = this.findFirstAvailableNonce(state);
      const reservationId = randomUUID();
      const now = Date.now();
      const expiresAt = new Date(now + ttlMs).toISOString();

      state.reservations[String(nonce)] = {
        reservationId,
        nonce,
        reservedAt: new Date(now).toISOString(),
        expiresAt,
      };
      state.nextNonce = Math.max(state.nextNonce, nonce + 1);
      state.updatedAt = new Date().toISOString();

      await this.persistState(state);

      return {
        network: chain.name,
        address: normalizedAddress,
        nonce,
        reservationId,
        expiresAt,
        chainNonce: state.chainNonce,
        nextNonce: state.nextNonce,
      };
    });
  }

  async commitReservation(
    address: string,
    reservationId: string,
    network = DEFAULT_NETWORK,
  ): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);

      const reservation = this.findReservationById(state, reservationId);
      if (!reservation) {
        throw new NotFoundException('Nonce reservation not found');
      }

      delete state.reservations[String(reservation.nonce)];
      if (!state.usedNonces.includes(reservation.nonce)) {
        state.usedNonces.push(reservation.nonce);
      }
      state.nextNonce = Math.max(state.nextNonce, reservation.nonce + 1);
      state.usedNonces.sort((a, b) => a - b);
      state.updatedAt = new Date().toISOString();

      await this.persistState(state);
      return state;
    });
  }

  async releaseReservation(
    address: string,
    reservationId: string,
    network = DEFAULT_NETWORK,
  ): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);

      const reservation = this.findReservationById(state, reservationId);
      if (!reservation) {
        throw new NotFoundException('Nonce reservation not found');
      }

      delete state.reservations[String(reservation.nonce)];
      state.updatedAt = new Date().toISOString();

      await this.persistState(state);
      return state;
    });
  }

  async syncNonce(
    address: string,
    network = DEFAULT_NETWORK,
  ): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);

      const provider = this.getProvider(chain);
      const chainNonce = await provider.getTransactionCount(
        normalizedAddress,
        'pending',
      );

      state.chainNonce = chainNonce;
      if (state.nextNonce < chainNonce) {
        state.nextNonce = chainNonce;
      }
      state.usedNonces = state.usedNonces.filter(
        (nonce) => nonce >= chainNonce,
      );
      state.updatedAt = new Date().toISOString();

      await this.persistState(state);
      return state;
    });
  }

  async fillNonceGaps(
    address: string,
    network = DEFAULT_NETWORK,
    reserveFirstGap = false,
    ttlMs = DEFAULT_RESERVATION_TTL_MS,
  ): Promise<GapFillResult> {
    const normalizedAddress = this.normalizeAddress(address);
    const chain = resolveChain(network);

    return this.withLock(chain.chainId, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, chain);
      await this.pruneExpiredReservations(state);

      const gapsBeforeReservation = this.detectGaps(state);
      let reserved: ReserveNonceResult | undefined;

      if (reserveFirstGap && gapsBeforeReservation.length > 0) {
        if (!Number.isInteger(ttlMs) || ttlMs < 1000) {
          throw new BadRequestException(
            'ttlMs must be an integer greater than or equal to 1000',
          );
        }

        const nonce = gapsBeforeReservation[0];
        const hasConflict =
          !!state.reservations[String(nonce)] ||
          state.usedNonces.includes(nonce);
        if (hasConflict) {
          throw new ConflictException(
            'Unable to reserve nonce gap due to conflict',
          );
        }

        const reservationId = randomUUID();
        const now = Date.now();
        const expiresAt = new Date(now + ttlMs).toISOString();

        state.reservations[String(nonce)] = {
          reservationId,
          nonce,
          reservedAt: new Date(now).toISOString(),
          expiresAt,
        };
        state.updatedAt = new Date().toISOString();

        reserved = {
          network: chain.name,
          address: normalizedAddress,
          nonce,
          reservationId,
          expiresAt,
          chainNonce: state.chainNonce,
          nextNonce: state.nextNonce,
        };
      }

      await this.persistState(state);

      return {
        network: chain.name,
        address: normalizedAddress,
        chainNonce: state.chainNonce,
        nextNonce: state.nextNonce,
        gaps: this.detectGaps(state),
        reserved,
      };
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      throw new BadRequestException('Invalid wallet address');
    }
  }

  /**
   * Cache key is scoped to verified chainId + checksummed address so that
   * aliases for the same real chain share a single reservation namespace.
   */
  private cacheKey(chainId: number, address: string): string {
    return `nonce:state:${chainId}:${address}`;
  }

  /**
   * Lock key mirrors the state key so the distributed mutex covers the same
   * scope as the data it protects.
   */
  private lockKey(chainId: number, address: string): string {
    return `nonce:lock:${chainId}:${address}`;
  }

  private async getOrInitState(
    address: string,
    chain: ChainEntry,
  ): Promise<NonceState> {
    const key = this.cacheKey(chain.chainId, address);
    const cached = await this.cache.get<NonceState>(key);
    if (cached) {
      return {
        ...cached,
        // Normalise to canonical name in case an alias was used.
        network: chain.name,
        usedNonces: [...(cached.usedNonces ?? [])],
        reservations: { ...(cached.reservations ?? {}) },
      };
    }

    const provider = this.getProvider(chain);
    const chainNonce = await provider.getTransactionCount(address, 'pending');

    const initialized: NonceState = {
      network: chain.name,
      address,
      chainNonce,
      nextNonce: chainNonce,
      usedNonces: [],
      reservations: {},
      updatedAt: new Date().toISOString(),
    };

    await this.persistState(initialized, chain.chainId);
    return initialized;
  }

  private async persistState(
    state: NonceState,
    chainId?: number,
  ): Promise<void> {
    // chainId may be passed explicitly when the state has not yet been stored
    // (first init) and chain.chainId is not yet encoded in state.
    const resolvedChainId =
      chainId ?? resolveChain(state.network).chainId;
    await this.cache.set(
      this.cacheKey(resolvedChainId, state.address),
      state,
    );
  }

  private async pruneExpiredReservations(state: NonceState): Promise<void> {
    const now = Date.now();
    for (const [nonceKey, reservation] of Object.entries(state.reservations)) {
      const expiresAt = new Date(reservation.expiresAt).getTime();
      if (Number.isNaN(expiresAt) || expiresAt <= now) {
        delete state.reservations[nonceKey];
      }
    }
  }

  private findFirstAvailableNonce(state: NonceState): number {
    const used = new Set(state.usedNonces);
    const reserved = new Set(
      Object.values(state.reservations).map((r) => r.nonce),
    );

    let candidate = Math.max(state.chainNonce, state.nextNonce);
    while (used.has(candidate) || reserved.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  private findReservationById(
    state: NonceState,
    reservationId: string,
  ): NonceReservation | undefined {
    return Object.values(state.reservations).find(
      (r) => r.reservationId === reservationId,
    );
  }

  private detectGaps(state: NonceState): number[] {
    const used = new Set(state.usedNonces);
    const reserved = new Set(
      Object.values(state.reservations).map((r) => r.nonce),
    );

    const maxUsed =
      state.usedNonces.length > 0 ? Math.max(...state.usedNonces) : -1;
    const maxReserved =
      reserved.size > 0 ? Math.max(...Array.from(reserved)) : -1;
    const highestKnown = Math.max(
      state.nextNonce,
      maxUsed + 1,
      maxReserved + 1,
    );

    const gaps: number[] = [];
    for (let nonce = state.chainNonce; nonce < highestKnown; nonce += 1) {
      if (!used.has(nonce) && !reserved.has(nonce)) {
        gaps.push(nonce);
      }
    }
    return gaps;
  }

  private getProvider(chain: ChainEntry): ethers.JsonRpcProvider {
    const cached = this.providerCache.get(chain.chainId);
    if (cached) return cached;

    // Allow runtime env-var override (BLOCKCHAIN_RPC_URL_<NAME_UPPER>).
    const envKey = `BLOCKCHAIN_RPC_URL_${chain.name.replace(/-/g, '_').toUpperCase()}`;
    const rpcUrl =
      this.config.get<string>(envKey) ??
      this.config.get<string>('BLOCKCHAIN_RPC_URL') ??
      chain.rpcUrl;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.providerCache.set(chain.chainId, provider);
    return provider;
  }

  // ── Distributed compare-and-set lock ──────────────────────────────────────
  //
  // Strategy:
  //   • Acquisition: spin-loop, each attempt reads the lock key from the shared
  //     cache (Redis in production).  If absent, write our token with a TTL
  //     (LOCK_TTL_MS) and immediately re-read to confirm we won the race.
  //     This two-step SET-then-GET is the simplest CAS pattern available
  //     without Lua scripts.  If our token is confirmed, we hold the lock.
  //   • Release: delete the key only when it still contains our token —
  //     prevents a late holder from evicting a newer owner.
  //   • Safety: the TTL bounds lease duration, so a crashed holder never
  //     blocks permanently.  Concurrent reservations for different (chainId,
  //     address) pairs use independent keys and never contend.

  private async withLock<T>(
    chainId: number,
    address: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const key = this.lockKey(chainId, address);
    const token = randomUUID();
    const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;

    // ── Acquire ────────────────────────────────────────────────────────────
    while (true) {
      const existing = await this.cache.get<string>(key);

      if (!existing) {
        // Slot appears free — attempt to claim it.
        await this.cache.set(key, token, LOCK_TTL_MS);
        // Re-read to confirm we won any concurrent SET race.
        const confirmed = await this.cache.get<string>(key);
        if (confirmed === token) break; // lock acquired
      }

      if (Date.now() >= deadline) {
        throw new ConflictException(
          `Could not acquire nonce lock for chainId=${chainId} address=${address} ` +
            `after ${LOCK_ACQUIRE_TIMEOUT_MS} ms. Try again shortly.`,
        );
      }

      await new Promise<void>((resolve) =>
        setTimeout(resolve, LOCK_RETRY_INTERVAL_MS),
      );
    }

    // ── Execute task ───────────────────────────────────────────────────────
    try {
      return await task();
    } finally {
      // ── Release: only remove the key if it still holds our token ─────────
      const current = await this.cache.get<string>(key);
      if (current === token) {
        await this.cache.del(key);
      }
    }
  }
}
