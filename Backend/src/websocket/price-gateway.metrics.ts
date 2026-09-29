import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Connection bookkeeping for the `/prices` namespace.
 *
 * The gateway already knows who is connected and what they subscribed to, but
 * it had no way to answer the operational questions that matter for a live
 * price feed: how many sockets are actually up, how many are answering
 * heartbeats, how many were dropped because they went silent, and how often
 * clients churn through reconnects after a deploy or a network blip.
 *
 * This tracker owns that bookkeeping. It deliberately holds no socket
 * references — the gateway stays responsible for emitting and disconnecting,
 * while this class only counts and reports, which keeps the counters testable
 * without standing up a Socket.IO server.
 */

export type PriceGatewayDisconnectReason =
  'client' | 'heartbeat-timeout' | 'rejected' | 'unauthenticated';

export interface PriceGatewayClientState {
  socketId: string;
  userId: string;
  connectedAt: string;
  lastSeenAt: string;
  heartbeatsAcked: number;
  subscriptions: number;
}

export interface PriceGatewayMetricsSnapshot {
  activeConnections: number;
  activeSubscriptions: number;
  subscribedMarkets: number;
  totalConnections: number;
  totalDisconnects: number;
  totalReconnects: number;
  totalRejectedConnections: number;
  totalUnauthenticatedConnections: number;
  totalHeartbeatsSent: number;
  totalHeartbeatsAcked: number;
  totalMissedHeartbeats: number;
  totalSubscriptionsAdded: number;
  totalSubscriptionsRemoved: number;
  heartbeatAckRate: number;
  missedHeartbeatRate: number;
  reconnectRate: number;
  subscribersByMarket: Record<string, number>;
  staleClients: PriceGatewayClientState[];
  generatedAt: string;
}

/** Per-socket heartbeat bookkeeping; the shape `collectStalledClients` returns. */
export interface TrackedClient {
  socketId: string;
  userId: string;
  connectedAtMs: number;
  lastSeenAtMs: number;
  heartbeatsAcked: number;
  markets: Set<string>;
}

const DEFAULTS = {
  heartbeatIntervalMs: 25_000,
  heartbeatTimeoutMs: 60_000,
  reconnectWindowMs: 30_000,
};

function readPositiveInt(raw: unknown, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

@Injectable()
export class PriceGatewayMetrics {
  private readonly logger = new Logger(PriceGatewayMetrics.name);

  private readonly clients = new Map<string, TrackedClient>();
  /** userId -> epoch ms of the last clean disconnect, used to spot reconnects. */
  private readonly recentDisconnects = new Map<string, number>();
  /** marketId -> number of sockets currently subscribed to it. */
  private readonly subscribersByMarket = new Map<string, number>();

  private connections = 0;
  private disconnects = 0;
  private reconnects = 0;
  private rejectedConnections = 0;
  private unauthenticatedConnections = 0;
  private heartbeatsSent = 0;
  private heartbeatsAcked = 0;
  private missedHeartbeats = 0;
  private subscriptionsAdded = 0;
  private subscriptionsRemoved = 0;

  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  readonly reconnectWindowMs: number;

  constructor(private readonly config: ConfigService) {
    this.heartbeatIntervalMs = readPositiveInt(
      config.get('PRICE_GATEWAY_HEARTBEAT_INTERVAL_MS'),
      DEFAULTS.heartbeatIntervalMs,
    );
    this.heartbeatTimeoutMs = readPositiveInt(
      config.get('PRICE_GATEWAY_HEARTBEAT_TIMEOUT_MS'),
      Math.max(DEFAULTS.heartbeatTimeoutMs, this.heartbeatIntervalMs * 2),
    );
    this.reconnectWindowMs = readPositiveInt(
      config.get('PRICE_GATEWAY_RECONNECT_WINDOW_MS'),
      DEFAULTS.reconnectWindowMs,
    );
  }

  /** Record a socket that completed authentication and was admitted. */
  registerClient(socketId: string, userId: string): void {
    const now = Date.now();
    const lastSeen = this.recentDisconnects.get(userId);

    this.connections += 1;
    if (lastSeen !== undefined && now - lastSeen <= this.reconnectWindowMs) {
      this.reconnects += 1;
    }
    this.recentDisconnects.delete(userId);

    this.clients.set(socketId, {
      socketId,
      userId,
      connectedAtMs: now,
      lastSeenAtMs: now,
      heartbeatsAcked: 0,
      markets: new Set<string>(),
    });
  }

  /** Record a socket that was refused (per-client connection cap). */
  recordRejectedConnection(userId?: string): void {
    this.rejectedConnections += 1;
    this.logger.warn(
      `Price gateway connection rejected${userId ? ` for user ${userId}` : ''}`,
    );
  }

  /** Record a socket that never authenticated. */
  recordUnauthenticatedConnection(): void {
    this.unauthenticatedConnections += 1;
  }

  /** Record a heartbeat emitted to the connected clients. */
  recordHeartbeatBroadcast(socketsNotified: number): void {
    this.heartbeatsSent += socketsNotified;
  }

  /** Record a heartbeat acknowledgement from a live socket. */
  recordHeartbeatAck(socketId: string): void {
    const client = this.clients.get(socketId);
    if (!client) {
      return;
    }
    client.lastSeenAtMs = Date.now();
    client.heartbeatsAcked += 1;
    this.heartbeatsAcked += 1;
  }

  /** Apply a subscription delta to the per-market subscriber counts. */
  recordSubscriptionDelta(
    socketId: string,
    added: string[],
    removed: string[],
  ): void {
    const client = this.clients.get(socketId);
    if (!client) {
      return;
    }

    for (const marketId of added) {
      if (client.markets.has(marketId)) {
        continue;
      }
      client.markets.add(marketId);
      this.subscribersByMarket.set(
        marketId,
        (this.subscribersByMarket.get(marketId) ?? 0) + 1,
      );
      this.subscriptionsAdded += 1;
    }

    for (const marketId of removed) {
      if (!client.markets.delete(marketId)) {
        continue;
      }
      const next = (this.subscribersByMarket.get(marketId) ?? 1) - 1;
      if (next > 0) {
        this.subscribersByMarket.set(marketId, next);
      } else {
        this.subscribersByMarket.delete(marketId);
      }
      this.subscriptionsRemoved += 1;
    }
  }

  /**
   * Remove a socket from the tracked set.
   *
   * `heartbeat-timeout` is treated as an abnormal drop: the socket is counted
   * as a missed heartbeat and the user is remembered as "just went away" so the
   * next connection from the same user is scored as a reconnect.
   */
  recordDisconnect(
    socketId: string,
    reason: PriceGatewayDisconnectReason,
  ): void {
    const client = this.clients.get(socketId);
    if (!client) {
      return;
    }

    this.clients.delete(socketId);
    this.releaseSubscriptions(client);
    this.disconnects += 1;

    if (reason === 'heartbeat-timeout') {
      this.missedHeartbeats += 1;
    }

    // Both a clean disconnect and a dropped socket mean the user went away
    // "just now", so the next connection from them is a reconnect either way.
    if (reason === 'client' || reason === 'heartbeat-timeout') {
      this.recentDisconnects.set(client.userId, Date.now());
    }
  }

  /**
   * Find sockets that have not acknowledged a heartbeat within the timeout.
   *
   * Each socket is reported at most once: it is removed from the tracked set
   * here, so a caller that never disconnects it cannot inflate the counter.
   */
  collectStalledClients(now = Date.now()): TrackedClient[] {
    const stalled: TrackedClient[] = [];

    for (const [socketId, client] of this.clients) {
      if (now - client.lastSeenAtMs <= this.heartbeatTimeoutMs) {
        continue;
      }
      this.recordDisconnect(socketId, 'heartbeat-timeout');
      stalled.push(client);
    }

    return stalled;
  }

  getSnapshot(): PriceGatewayMetricsSnapshot {
    const activeSubscriptions = Array.from(this.clients.values()).reduce(
      (total, client) => total + client.markets.size,
      0,
    );

    return {
      activeConnections: this.clients.size,
      activeSubscriptions,
      subscribedMarkets: this.subscribersByMarket.size,
      totalConnections: this.connections,
      totalDisconnects: this.disconnects,
      totalReconnects: this.reconnects,
      totalRejectedConnections: this.rejectedConnections,
      totalUnauthenticatedConnections: this.unauthenticatedConnections,
      totalHeartbeatsSent: this.heartbeatsSent,
      totalHeartbeatsAcked: this.heartbeatsAcked,
      totalMissedHeartbeats: this.missedHeartbeats,
      totalSubscriptionsAdded: this.subscriptionsAdded,
      totalSubscriptionsRemoved: this.subscriptionsRemoved,
      heartbeatAckRate: ratio(this.heartbeatsAcked, this.heartbeatsSent),
      missedHeartbeatRate: ratio(this.missedHeartbeats, this.connections),
      reconnectRate: ratio(this.reconnects, this.connections),
      subscribersByMarket: Object.fromEntries(this.subscribersByMarket),
      staleClients: this.getTrackedClients(),
      generatedAt: new Date().toISOString(),
    };
  }

  private releaseSubscriptions(client: TrackedClient): void {
    for (const marketId of client.markets) {
      const next = (this.subscribersByMarket.get(marketId) ?? 1) - 1;
      if (next > 0) {
        this.subscribersByMarket.set(marketId, next);
      } else {
        this.subscribersByMarket.delete(marketId);
      }
    }
    client.markets.clear();
  }

  private getTrackedClients(): PriceGatewayClientState[] {
    return Array.from(this.clients.values()).map((client) => ({
      socketId: client.socketId,
      userId: client.userId,
      connectedAt: new Date(client.connectedAtMs).toISOString(),
      lastSeenAt: new Date(client.lastSeenAtMs).toISOString(),
      heartbeatsAcked: client.heartbeatsAcked,
      subscriptions: client.markets.size,
    }));
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}
