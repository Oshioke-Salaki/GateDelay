import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Position } from './position.entity';
import { OpenPositionDto, ClosePositionDto } from './dto/position.dto';

@Injectable()
export class PositionsService {
  private readonly positions = new Map<string, Position>();

  open(userId: string, dto: OpenPositionDto): Position {
    const costBasis = dto.shares * dto.entryPrice;
    const position: Position = {
      id: uuidv4(),
      userId,
      marketId: dto.marketId,
      side: dto.side,
      shares: dto.shares,
      entryPrice: dto.entryPrice,
      currentPrice: dto.entryPrice,
      costBasis,
      pnl: 0,
      pnlPct: 0,
      maxLoss: costBasis,
      status: 'open',
      openedAt: new Date(),
    };
    this.positions.set(position.id, position);
    return position;
  }

  getUserPositions(userId: string): Position[] {
    return [...this.positions.values()].filter((p) => p.userId === userId);
  }

  getOne(userId: string, id: string): Position {
    const position = this.positions.get(id);
    if (!position) throw new NotFoundException('Position not found');
    if (position.userId !== userId) throw new ForbiddenException();
    return this._withMetrics(position);
  }

  close(userId: string, id: string, dto: ClosePositionDto): Position {
    const position = this.getOne(userId, id);
    if (position.status === 'closed')
      throw new ForbiddenException('Position already closed');
    position.currentPrice = dto.currentPrice;
    position.status = 'closed';
    position.closedAt = new Date();
    return this._withMetrics(position);
  }

  // Called by PriceGateway on price updates
  updateMarketPrice(marketId: string, currentPrice: number): void {
    this.positions.forEach((p) => {
      if (p.marketId === marketId && p.status === 'open') {
        p.currentPrice = currentPrice;
        this._withMetrics(p);
      }
    });
  }

  getUsersForMarket(marketId: string): string[] {
    const users = new Set<string>();
    this.positions.forEach((p) => {
      if (p.marketId === marketId && p.status === 'open') users.add(p.userId);
    });
    return [...users];
  }

  private _withMetrics(p: Position): Position {
    const priceDiff =
      p.side === 'YES'
        ? p.currentPrice - p.entryPrice
        : p.entryPrice - p.currentPrice;
    p.pnl = priceDiff * p.shares;
    p.pnlPct = p.costBasis > 0 ? (p.pnl / p.costBasis) * 100 : 0;
    p.maxLoss = p.costBasis;
    return p;
  }
}
