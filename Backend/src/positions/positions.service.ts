import Big from 'big.js';
import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Position } from './position.entity';
import { StoredPosition, AppliedExecution } from './position.schema';
import { OpenPositionDto, ClosePositionDto, ExecutionPositionDto } from './dto/position.dto';
import { ExecutionVerifier } from './execution-verifier.service';

const WAD = 10n ** 18n;
/** Round half away from zero, only at the API boundary. */
export function decimalRatio(n: bigint, d: bigint, places = 18): string {
  if (d <= 0n) return '0';
  const scale = 10n ** BigInt(places);
  const a = n < 0n ? -n : n;
  const rounded = (a * scale + d / 2n) / d;
  const digits = rounded.toString().padStart(places + 1, '0');
  return (n < 0n && rounded !== 0n ? '-' : '') + digits.slice(0, -places) + '.' + digits.slice(-places);
}

@Injectable()
export class PositionsService {
  constructor(
    @InjectModel('Position') private readonly positions: Model<StoredPosition>,
    @InjectModel('AppliedExecution') private readonly executions: Model<AppliedExecution>,
    private readonly verifier: ExecutionVerifier,
  ) {}

  open(userId: string, dto: OpenPositionDto): Promise<Position> {
    return this.apply(userId, dto, 'BUY');
  }
  close(userId: string, id: string, dto: ClosePositionDto): Promise<Position> {
    return this.apply(userId, dto, 'SELL', id);
  }

  private async apply(userId: string, dto: ExecutionPositionDto, action: string, id?: string): Promise<Position> {
    const e = await this.verifier.verify(userId, dto);
    if (e.action !== action) throw new BadRequestException('Wrong execution direction');
    const identity = { account: e.account, chainId: e.chainId, contract: e.contract, marketId: e.marketId, side: e.side };
    const session = await this.positions.db.startSession();
    let result!: Position;
    try {
      // Never fall back to nontransactional writes. Requires a MongoDB replica set.
      await session.withTransaction(async () => {
        let p = await this.positions.findOne(identity).session(session).exec();
        if (p && p.userId !== userId) throw new ForbiddenException('Account position is linked to another user');
        if (id && (!p || p.id !== id)) throw new NotFoundException('Position does not match execution');
        const applied = await this.executions.findOne({ key: e.key }).session(session).exec();
        if (applied) {
          if (!p || applied.positionId !== p.id || applied.blockHash !== e.blockHash) throw new ConflictException('Execution identity conflict');
          result = this.present(p);
          return;
        }
        if (p && (e.blockNumber < p.lastBlock || (e.blockNumber === p.lastBlock && e.logIndex <= p.lastLog))) {
          throw new ConflictException('Apply executions in canonical block/log order');
        }
        if (!p) {
          if (action !== 'BUY') throw new ConflictException('Cannot sell without recorded holdings');
          p = new this.positions({ ...identity, id: randomUUID(), userId, shareUnits: '0', costUnits: '0', realizedUnits: '0', priceUnits: '0', openedAt: e.timestamp });
        }
        const shares = BigInt(p.shareUnits);
        const cost = BigInt(p.costUnits);
        if (action === 'BUY') {
          if (shares === 0n) { p.openedAt = e.timestamp; p.closedAt = undefined; }
          p.shareUnits = (shares + e.shares).toString();
          p.costUnits = (cost + e.collateral).toString();
        } else {
          if (e.shares > shares) throw new ConflictException('Execution exceeds recorded holdings; import missing buys first');
          // Floor proportional average cost; final sale consumes the exact remainder.
          const released = e.shares === shares ? cost : cost * e.shares / shares;
          p.shareUnits = (shares - e.shares).toString();
          p.costUnits = (cost - released).toString();
          p.realizedUnits = (BigInt(p.realizedUnits) + e.collateral - released).toString();
          if (e.shares === shares) p.closedAt = e.timestamp;
        }
        p.priceUnits = (e.collateral * WAD / e.shares).toString();
        p.lastBlock = e.blockNumber;
        p.lastLog = e.logIndex;
        await p.save({ session });
        await this.executions.create([{ key: e.key, positionId: p.id, blockHash: e.blockHash, shareUnits: e.shares.toString(), collateralUnits: e.collateral.toString(), action }], { session });
        result = this.present(p);
      });
      return result;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Concurrent execution application; retry this same event reference');
      }
      throw error;
    } finally { await session.endSession(); }
  }

  async getUserPositions(userId: string): Promise<Position[]> {
    return (await this.positions.find({ userId }).exec()).map(p => this.present(p));
  }
  async getOne(userId: string, id: string): Promise<Position> {
    const p = await this.positions.findOne({ id }).exec();
    if (!p) throw new NotFoundException('Position not found');
    if (p.userId !== userId) throw new ForbiddenException();
    return this.present(p);
  }

  // Feed prices are YES probabilities. Scope updates by chain to avoid market ID collisions.
  async updateMarketPrice(marketId: string, yesPrice: number, chainId?: string): Promise<void> {
    if (!chainId) return;
    if (!Number.isFinite(yesPrice) || yesPrice < 0 || yesPrice > 1) throw new BadRequestException('Invalid YES price');
    const price = BigInt(new Big(String(yesPrice)).times('1000000000000000000').toFixed(0, Big.roundHalfUp));
    await this.positions.updateMany({ marketId, chainId, side: 'YES', shareUnits: { $ne: '0' } }, { priceUnits: price.toString() }).exec();
    await this.positions.updateMany({ marketId, chainId, side: 'NO', shareUnits: { $ne: '0' } }, { priceUnits: (WAD - price).toString() }).exec();
  }
  async getUsersForMarket(marketId: string): Promise<string[]> {
    return this.positions.distinct('userId', { marketId, shareUnits: { $ne: '0' } }).exec();
  }
  private present(p: StoredPosition): Position {
    const shares = BigInt(p.shareUnits), cost = BigInt(p.costUnits);
    const value = shares * BigInt(p.priceUnits) / WAD;
    const pnl = value - cost;
    return {
      id: p.id, userId: p.userId, account: p.account, chainId: p.chainId, marketId: p.marketId, side: p.side,
      shares: decimalRatio(shares, WAD), entryPrice: decimalRatio(cost, shares), currentPrice: decimalRatio(BigInt(p.priceUnits), WAD),
      costBasis: decimalRatio(cost, WAD), pnl: decimalRatio(pnl, WAD), realizedPnl: decimalRatio(BigInt(p.realizedUnits), WAD),
      pnlPct: decimalRatio(pnl * 100n, cost, 8), maxLoss: decimalRatio(cost, WAD),
      status: shares === 0n ? 'closed' : 'open', openedAt: p.openedAt, closedAt: p.closedAt,
    };
  }
}
