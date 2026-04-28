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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PositionsService } from '../positions/positions.service';
import { PortfolioService } from '../portfolio/portfolio.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/prices',
})
export class PriceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PriceGateway.name);
  private readonly subscriptions = new Map<string, Set<string>>(); // socketId -> marketIds
  private readonly maxConnectionsPerClient = 5;
  private readonly clientConnections = new Map<string, number>(); // clientId -> count

  constructor(
    private readonly jwtService: JwtService,
    private readonly positionsService: PositionsService,
    private readonly portfolioService: PortfolioService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;

      const count = this.clientConnections.get(payload.sub) || 0;
      if (count >= this.maxConnectionsPerClient) {
        this.logger.warn(`Max connections reached for user ${payload.sub}`);
        client.disconnect();
        return;
      }
      this.clientConnections.set(payload.sub, count + 1);
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (err) {
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
    this.logger.log(`Client disconnected: ${client.id}`);
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
    data.marketIds.forEach((id) => existing.add(id));
    this.subscriptions.set(client.id, existing);
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
    data.marketIds.forEach((id) => existing.delete(id));
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
}
