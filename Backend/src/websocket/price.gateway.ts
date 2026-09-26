import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PositionsService } from '../positions/positions.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import {
  PriceGatewayDisconnectReason,
  PriceGatewayMetrics,
} from './price-gateway.metrics';

/** Event the server sends on every heartbeat tick. */
const HEARTBEAT_EVENT = 'heartbeat';
/** Event clients must send back so we can tell a live socket from a dead one. */
const HEARTBEAT_ACK_EVENT = 'heartbeat:ack';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/prices',
})
export class PriceGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PriceGateway.name);
  private readonly subscriptions = new Map<string, Set<string>>(); // socketId -> marketIds
  private readonly maxConnectionsPerClient = 5;
  private readonly clientConnections = new Map<string, number>(); // clientId -> count
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly positionsService: PositionsService,
    private readonly portfolioService: PortfolioService,
    private readonly metrics: PriceGatewayMetrics,
  ) {}

  onModuleInit(): void {
    const interval = this.metrics.heartbeatIntervalMs;
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), interval);
    this.heartbeatTimer.unref?.();
    this.logger.log(
      `Price gateway heartbeat started (every ${interval}ms, timeout ${this.metrics.heartbeatTimeoutMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        this.metrics.recordUnauthenticatedConnection();
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;

      const count = this.clientConnections.get(payload.sub) || 0;
      if (count >= this.maxConnectionsPerClient) {
        this.metrics.recordRejectedConnection(payload.sub);
        this.logger.warn(`Max connections reached for user ${payload.sub}`);
        client.disconnect();
        return;
      }
      this.clientConnections.set(payload.sub, count + 1);
      this.metrics.registerClient(client.id, payload.sub);
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (err) {
      this.metrics.recordUnauthenticatedConnection();
      this.logger.error('Invalid token', err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const count = this.clientConnections.get(userId) || 1;
      this.clientConnections.set(userId, count - 1);
      if (count - 1 <= 0) this.clientConnections.delete(userId);
    }
    this.subscriptions.delete(client.id);
    this.metrics.recordDisconnect(client.id, 'client');
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(HEARTBEAT_ACK_EVENT)
  handleHeartbeatAck(@ConnectedSocket() client: Socket) {
    this.metrics.recordHeartbeatAck(client.id);
    return { ok: true, serverTime: Date.now() };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { marketIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.marketIds || !Array.isArray(data.marketIds)) {
      return { error: 'Invalid marketIds' };
    }
    const existing = this.subscriptions.get(client.id) || new Set();
    const added = data.marketIds.filter((id) => !existing.has(id));
    data.marketIds.forEach((id) => existing.add(id));
    this.subscriptions.set(client.id, existing);
    this.metrics.recordSubscriptionDelta(client.id, added, []);
    this.logger.log(
      `Client ${client.id} subscribed to ${data.marketIds.join(', ')}`,
    );
    return { subscribed: Array.from(existing) };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { marketIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    const existing = this.subscriptions.get(client.id);
    if (!existing) return { unsubscribed: [] };
    const removed = data.marketIds.filter((id) => existing.has(id));
    data.marketIds.forEach((id) => existing.delete(id));
    this.metrics.recordSubscriptionDelta(client.id, [], removed);
    this.logger.log(
      `Client ${client.id} unsubscribed from ${data.marketIds.join(', ')}`,
    );
    return { subscribed: Array.from(existing) };
  }

  broadcastPriceUpdate(
    marketId: string,
    data: { price: number; volume: number; timestamp: number },
  ) {
    this.positionsService.updateMarketPrice(marketId, data.price);
    // snapshot portfolio for all users with positions in this market
    this.positionsService
      .getUsersForMarket(marketId)
      .forEach((userId) => this.portfolioService.recordSnapshot(userId));
    this.subscriptions.forEach((markets, socketId) => {
      if (markets.has(marketId)) {
        this.server.to(socketId).emit('priceUpdate', { marketId, ...data });
      }
    });
  }

  broadcastMarketData(data: Record<string, unknown>) {
    this.server.emit('marketData', data);
  }

  /**
   * Emit a heartbeat to every socket in the namespace and evict the ones that
   * have gone silent. A client that never answers is holding a connection slot
   * and receives no prices, so it is dropped rather than left to linger.
   */
  private sendHeartbeat(): void {
    if (!this.server?.sockets) {
      return;
    }

    const serverTime = Date.now();
    let notified = 0;
    this.server.sockets.forEach((socket) => {
      socket.emit(HEARTBEAT_EVENT, { serverTime });
      notified += 1;
    });
    this.metrics.recordHeartbeatBroadcast(notified);

    const stalled = this.metrics.collectStalledClients(serverTime);
    for (const client of stalled) {
      this.logger.warn(
        `Dropping price gateway client ${client.socketId} (user ${client.userId}): no heartbeat for ${this.metrics.heartbeatTimeoutMs}ms`,
      );
      this.dropSocket(client.socketId, 'heartbeat-timeout');
    }
  }

  private dropSocket(socketId: string, reason: PriceGatewayDisconnectReason) {
    const socket = this.server.sockets.get(socketId);
    // Mark disconnected first so the disconnect handler cannot double-count.
    this.metrics.recordDisconnect(socketId, reason);
    if (socket) {
      socket.disconnect(true);
    }
  }
}
