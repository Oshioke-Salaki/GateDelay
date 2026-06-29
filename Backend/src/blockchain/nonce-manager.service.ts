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

const DEFAULT_NETWORK = 'mantle';
const DEFAULT_RESERVATION_TTL_MS = 30_000;

@Injectable()
export class NonceManagerService {
  private readonly providerCache = new Map<string, ethers.JsonRpcProvider>();
  private readonly mutexes = new Map<string, Promise<void>>();

  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getNonceState(
    address: string,
    network = DEFAULT_NETWORK,
  ): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
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
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
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
        network: normalizedNetwork,
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
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
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
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
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

  async syncNonce(address: string, network = DEFAULT_NETWORK): Promise<NonceState> {
    const normalizedAddress = this.normalizeAddress(address);
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
      await this.pruneExpiredReservations(state);

      const provider = this.getProvider(normalizedNetwork);
      const chainNonce = await provider.getTransactionCount(
        normalizedAddress,
        'pending',
      );

      state.chainNonce = chainNonce;
      if (state.nextNonce < chainNonce) {
        state.nextNonce = chainNonce;
      }
      state.usedNonces = state.usedNonces.filter((nonce) => nonce >= chainNonce);
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
    const normalizedNetwork = this.normalizeNetwork(network);

    return this.withLock(normalizedNetwork, normalizedAddress, async () => {
      const state = await this.getOrInitState(normalizedAddress, normalizedNetwork);
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
          !!state.reservations[String(nonce)] || state.usedNonces.includes(nonce);
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
          network: normalizedNetwork,
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
        network: normalizedNetwork,
        address: normalizedAddress,
        chainNonce: state.chainNonce,
        nextNonce: state.nextNonce,
        gaps: this.detectGaps(state),
        reserved,
      };
    });
  }

  private normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      throw new BadRequestException('Invalid wallet address');
    }
  }

  private normalizeNetwork(network: string): string {
    return (network || DEFAULT_NETWORK).trim().toLowerCase();
  }

  private cacheKey(network: string, address: string): string {
    return `nonce:state:${network}:${address}`;
  }

  private async getOrInitState(address: string, network: string): Promise<NonceState> {
    const key = this.cacheKey(network, address);
    const cached = await this.cache.get<NonceState>(key);
    if (cached) {
      return {
        ...cached,
        usedNonces: [...(cached.usedNonces ?? [])],
        reservations: { ...(cached.reservations ?? {}) },
      };
    }

    const provider = this.getProvider(network);
    const chainNonce = await provider.getTransactionCount(address, 'pending');

    const initialized: NonceState = {
      network,
      address,
      chainNonce,
      nextNonce: chainNonce,
      usedNonces: [],
      reservations: {},
      updatedAt: new Date().toISOString(),
    };

    await this.persistState(initialized);
    return initialized;
  }

  private async persistState(state: NonceState): Promise<void> {
    await this.cache.set(this.cacheKey(state.network, state.address), state);
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
      Object.values(state.reservations).map((reservation) => reservation.nonce),
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
      (reservation) => reservation.reservationId === reservationId,
    );
  }

  private detectGaps(state: NonceState): number[] {
    const used = new Set(state.usedNonces);
    const reserved = new Set(
      Object.values(state.reservations).map((reservation) => reservation.nonce),
    );

    const maxUsed = state.usedNonces.length > 0 ? Math.max(...state.usedNonces) : -1;
    const maxReserved =
      reserved.size > 0 ? Math.max(...Array.from(reserved.values())) : -1;
    const highestKnown = Math.max(state.nextNonce, maxUsed + 1, maxReserved + 1);

    const gaps: number[] = [];
    for (let nonce = state.chainNonce; nonce < highestKnown; nonce += 1) {
      if (!used.has(nonce) && !reserved.has(nonce)) {
        gaps.push(nonce);
      }
    }

    return gaps;
  }

  private getProvider(network: string): ethers.JsonRpcProvider {
    const normalizedNetwork = this.normalizeNetwork(network);
    const cached = this.providerCache.get(normalizedNetwork);
    if (cached) return cached;

    const networkConfigKey =
      `BLOCKCHAIN_RPC_URL_${normalizedNetwork.toUpperCase()}`;
    const fallbackRpc = this.config.get<string>(
      'BLOCKCHAIN_RPC_URL',
      'https://rpc.mantle.xyz',
    );
    const rpcUrl = this.config.get<string>(networkConfigKey, fallbackRpc);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.providerCache.set(normalizedNetwork, provider);
    return provider;
  }

  private async withLock<T>(
    network: string,
    address: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `${network}:${address}`;
    const previous = this.mutexes.get(lockKey) ?? Promise.resolve();

    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const lockToken = previous.then(() => current);
    this.mutexes.set(lockKey, lockToken);

    await previous;

    try {
      return await task();
    } finally {
      release();
      if (this.mutexes.get(lockKey) === lockToken) {
        this.mutexes.delete(lockKey);
      }
    }
  }
}
