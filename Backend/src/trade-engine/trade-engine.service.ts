import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import Big from 'big.js';
import * as async from 'async';
import { createRequire } from 'module';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { PlaceOrderDto } from './dto/place-order.dto';
import {
  assertConfiguredClobVenue,
  getConfiguredClobVenuePairs,
  isConfiguredClobVenue,
} from '../trading-venues/clob-venue.policy';

export interface MatchResult {
  makerOrderId: string;
  amount: string;
  price: string;
  executionType: 'CLOB';
  venueId: string;
  pair: string;
  settlementStatus: 'NOT_ON_CHAIN';
}

export interface ClobExecutionResult {
  order: OrderDocument;
  matches: MatchResult[];
  execution: {
    type: 'CLOB';
    venueId: string;
    pair: string;
    settlementStatus: 'NOT_ON_CHAIN';
  };
}

export interface PlaceOrderOptions {
  /**
   * Client-supplied `Idempotency-Key`. When present, a repeated call replays
   * the original CLOB execution result instead of opening a second order.
   */
  idempotencyKey?: string;
}

// Redis-backed idempotency keys (#912) — the CommonJS services/idempotencyService.js
// shared with the legacy Express entrypoint. Bridged the same way
// resolution.service.ts bridges services/auditTrail.js.
/** Subset of the CommonJS error surface this service depends on. */
interface IdempotencyErrorShape extends Error {
  code: string;
  statusCode: number;
}

const nodeRequire = createRequire(__filename);
const idempotency = nodeRequire('../../services/idempotencyService') as {
  IdempotencyError: new (
    message: string,
    code: string,
    statusCode: number,
  ) => IdempotencyErrorShape;
  withIdempotency: (
    scope: string,
    key: string,
    fn: () => Promise<unknown>,
    options?: { statusCode?: number; ttlSeconds?: number },
  ) => Promise<{ replayed: boolean; response?: unknown }>;
};

/** Scope for CLOB order placement and matching. */
const TRADE_PLACEMENT_SCOPE = 'trade-placement';

/**
 * TradeEngineService
 *
 * Orchestrates the full order lifecycle:
 *   1. Validate order constraints per type (Market / Limit / Stop-Loss).
 *   2. Persist the new order as 'Pending'.
 *   3. Run Price-Time priority matching against the live order book.
 *   4. Persist matched CLOB fills atomically.
 *   5. Leave any residual amount resting in the order book as 'Partial'.
 *
 * Financial arithmetic exclusively uses big.js to eliminate floating-point
 * rounding errors.
 *
 * Matching is serialised per configured CLOB venue/pair via an async.queue
 * (concurrency=1), so independent venues never share an order book.
 */
@Injectable()
export class TradeEngineService {
  private readonly logger = new Logger(TradeEngineService.name);

  /**
   * Per-venue/pair async queues (concurrency = 1).
   * Keeps distinct configured CLOB venues isolated.
   */
  private readonly matchQueues = new Map<
    string,
    async.QueueObject<OrderDocument>
  >();

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────── Public API

  /**
   * Place a new order, validate, persist, then enqueue for matching.
   *
   * Placement and CLOB matching happen in one call, so a single idempotency key
   * covers both: a client that retries after a lost response gets the original
   * CLOB execution result rather than a second order.
   */
  async placeOrder(
    userId: string,
    dto: PlaceOrderDto,
    options: PlaceOrderOptions = {},
  ): Promise<ClobExecutionResult> {
    const idempotencyKey = options.idempotencyKey?.trim();

    if (!idempotencyKey) {
      return this.executePlacement(userId, dto);
    }

    // Scope the key to the user so one client cannot collide with another's.
    const scopedKey = `${userId}.${idempotencyKey}`;

    try {
      const outcome = await idempotency.withIdempotency(
        TRADE_PLACEMENT_SCOPE,
        scopedKey,
        () => this.executePlacement(userId, dto),
        { statusCode: 201 },
      );

      if (outcome.replayed) {
        this.logger.log(
          `Replayed idempotent order placement for user ${userId} (key ${idempotencyKey})`,
        );
      }

      return outcome.response as ClobExecutionResult;
    } catch (err) {
      // Surface the store's 400/409 as the matching HTTP status rather than a
      // generic 500, so a client can tell a bad key from a real conflict.
      if (err instanceof idempotency.IdempotencyError) {
        const message = err.message;
        throw err.statusCode === 409
          ? new ConflictException(message)
          : new BadRequestException(message);
      }
      throw err;
    }
  }

  private async executePlacement(
    userId: string,
    dto: PlaceOrderDto,
  ): Promise<ClobExecutionResult> {
    const configuredVenue = assertConfiguredClobVenue(dto.venueId, dto.pair);
    this.validateOrderConstraints(dto);

    const order = await this.orderModel.create({
      userId,
      venueId: configuredVenue.venueId,
      executionType: 'CLOB',
      settlementStatus: 'NOT_ON_CHAIN',
      type: dto.type,
      side: dto.side,
      pair: configuredVenue.pair,
      price: dto.price ?? '0',
      stopPrice: dto.stopPrice ?? '0',
      amount: dto.amount,
      filled: '0',
      status: 'Pending',
      timestamp: new Date(),
    });

    this.logger.log(
      `Order created: ${order.id} | ${order.side} ${order.amount} ${order.pair} @ ${order.price} [${order.type}]`,
    );

    return this.enqueueForMatching(order);
  }

  /**
   * Cancel an open / partial order.
   */
  async cancelOrder(userId: string, orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertConfiguredOrder(order);
    if (order.userId !== userId)
      throw new BadRequestException('Not authorised to cancel this order');
    if (order.status === 'Filled' || order.status === 'Canceled')
      throw new BadRequestException(
        `Order is already ${order.status} and cannot be canceled`,
      );

    order.status = 'Canceled';
    await order.save();
    this.logger.log(`Order canceled: ${order.id}`);
    return order;
  }

  /**
   * Get a single order by ID.
   */
  async getOrder(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertConfiguredOrder(order);
    return order;
  }

  /**
   * Get all orders for a user, optionally filtered by status.
   */
  async getUserOrders(
    userId: string,
    status?: OrderStatus,
  ): Promise<OrderDocument[]> {
    const filter: Record<string, unknown> = {
      userId,
      executionType: 'CLOB',
      settlementStatus: 'NOT_ON_CHAIN',
      $or: getConfiguredClobVenuePairs().map(({ venueId, pair }) => ({
        venueId,
        pair,
      })),
    };
    if (status) filter.status = status;
    return this.orderModel.find(filter).sort({ timestamp: -1 }).exec();
  }

  private assertConfiguredOrder(order: OrderDocument): void {
    if (
      order.executionType !== 'CLOB' ||
      order.settlementStatus !== 'NOT_ON_CHAIN' ||
      !isConfiguredClobVenue(order.venueId, order.pair)
    ) {
      throw new NotFoundException('CLOB order not found');
    }
  }

  /**
   * Get the live order book for a trading pair.
   */
  async getOrderBook(
    venueId: string,
    pair: string,
  ): Promise<{ bids: OrderDocument[]; asks: OrderDocument[] }> {
    const venue = assertConfiguredClobVenue(venueId, pair);
    const [bids, asks] = await Promise.all([
      this.orderModel
        .find({
          venueId: venue.venueId,
          pair: venue.pair,
          side: 'Buy',
          status: { $in: ['Pending', 'Partial'] },
        })
        .sort({ price: -1, timestamp: 1 })
        .exec(),
      this.orderModel
        .find({
          venueId: venue.venueId,
          pair: venue.pair,
          side: 'Sell',
          status: { $in: ['Pending', 'Partial'] },
        })
        .sort({ price: 1, timestamp: 1 })
        .exec(),
    ]);
    return { bids, asks };
  }

  // ──────────────────────────────────────────────────────────── Matching Queue

  /**
   * Wrap matching in a per-venue/pair serialised async.queue.
   */
  private enqueueForMatching(order: OrderDocument): Promise<ClobExecutionResult> {
    const queueKey = JSON.stringify([order.venueId, order.pair]);
    if (!this.matchQueues.has(queueKey)) {
      const q = async.queue<OrderDocument>(
        (o, callback) => {
          this.runMatchingCycle(o)
            .then((r) => callback(null, r))
            .catch((err: Error) => callback(err));
        },
        1, // concurrency = 1 → serialised per pair
      );
      this.matchQueues.set(queueKey, q);
    }

    return new Promise<ClobExecutionResult>((resolve, reject) => {
      this.matchQueues.get(queueKey)!.push(order, (err, result) => {
        if (err) return reject(err);
        resolve(result as ClobExecutionResult);
      });
    });
  }

  // ──────────────────────────────────────────────────────── Matching Cycle

  /**
   * Core matching cycle:
   *   1. Find compatible resting orders (Price-Time priority).
   *   2. Persist CLOB fills atomically within a Mongoose session transaction.
   */
  private async runMatchingCycle(
    takerOrder: OrderDocument,
  ): Promise<ClobExecutionResult> {
    const candidates = await this.findCandidates(takerOrder);
    const matches: MatchResult[] = [];

    // Use a Mongoose session for atomic multi-document updates.
    // Falls back gracefully when running without a replica set (e.g. tests).
    let session: ClientSession | null = null;
    try {
      session = await this.orderModel.db.startSession();
      session.startTransaction();
    } catch {
      // No replica set — continue without transaction (unit test environment)
      session = null;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        async.waterfall(
          [
            // Step 1: compute fills
            (next: (err: Error | null, fills: MatchResult[]) => void) => {
              const fills = this.computeFills(takerOrder, candidates);
              next(null, fills);
            },

            // Step 2: persist fills atomically
            (fills: MatchResult[], next: (err: Error | null) => void) => {
              this.persistFills(takerOrder, fills, candidates, session)
                .then(() => {
                  matches.push(...fills);
                  next(null);
                })
                .catch((err: Error) => next(err));
            },
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });

      if (session) {
        await session.commitTransaction();
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    const updatedOrder = await this.orderModel.findById(takerOrder._id);
    return {
      order: updatedOrder!,
      matches,
      execution: {
        type: 'CLOB',
        venueId: takerOrder.venueId,
        pair: takerOrder.pair,
        settlementStatus: 'NOT_ON_CHAIN',
      },
    };
  }

  // ─────────────────────────────────────────────────────── Candidate Selection

  /**
   * Fetch resting orders compatible with the incoming taker order,
   * sorted by Price-Time priority:
   *  - Bids: Highest price → Earliest timestamp
   *  - Asks: Lowest price  → Earliest timestamp
   */
  private async findCandidates(taker: OrderDocument): Promise<OrderDocument[]> {
    const oppositeSide = taker.side === 'Buy' ? 'Sell' : 'Buy';

    const query: Record<string, unknown> = {
      venueId: taker.venueId,
      pair: taker.pair,
      side: oppositeSide,
      status: { $in: ['Pending', 'Partial'] },
      userId: { $ne: taker.userId }, // no self-trading
    };

    if (taker.type === 'Limit') {
      // For a Limit Buy: only ask prices <= taker price
      // For a Limit Sell: only bid prices >= taker price
      if (taker.side === 'Buy') {
        query.price = { $lte: taker.price };
      } else {
        query.price = { $gte: taker.price };
      }
    } else if (taker.type === 'Stop-Loss') {
      // Stop-Loss triggers when market price hits stopPrice;
      // once triggered, it behaves like a Market order.
      // Here we treat it as a market order for matching purposes.
    }
    // Market orders: no price constraint — match best available price

    const sortDir = taker.side === 'Buy' ? 1 : -1; // Ask: asc, Bid: desc
    return this.orderModel
      .find(query)
      .sort({ price: sortDir, timestamp: 1 })
      .exec();
  }

  // ─────────────────────────────────────────────────────────── Fill Computation

  /**
   * Compute fill records using Price-Time priority.
   * Q_rem = Q_init − Σ Q_filled
   */
  private computeFills(
    taker: OrderDocument,
    candidates: OrderDocument[],
  ): MatchResult[] {
    const fills: MatchResult[] = [];
    let remaining = new Big(taker.amount).minus(new Big(taker.filled));

    for (const maker of candidates) {
      if (remaining.lte(0)) break;

      const makerRemaining = new Big(maker.amount).minus(new Big(maker.filled));
      const fillAmount = remaining.lte(makerRemaining)
        ? remaining
        : makerRemaining;

      fills.push({
        makerOrderId: (maker._id as unknown as string).toString(),
        amount: fillAmount.toString(),
        price: maker.price, // maker price = execution price
        executionType: 'CLOB',
        venueId: taker.venueId,
        pair: taker.pair,
        settlementStatus: 'NOT_ON_CHAIN',
      });

      remaining = remaining.minus(fillAmount);
    }

    return fills;
  }

  // ─────────────────────────────────────────────────────── Atomic CLOB fills

  /**
   * Persist all fills atomically:
   *  - Update each maker order's `filled` and `status`.
   *  - Update the taker order's `filled` and `status`.
   *  - All writes go through the same Mongoose session.
   */
  private async persistFills(
    takerOrder: OrderDocument,
    fills: MatchResult[],
    candidates: OrderDocument[],
    session: ClientSession | null,
  ): Promise<void> {
    const opts = session ? { session } : {};
    let takerFilled = new Big(takerOrder.filled);

    for (const fill of fills) {
      const maker = candidates.find(
        (c) => (c._id as unknown as string).toString() === fill.makerOrderId,
      );
      if (!maker) continue;

      const fillAmt = new Big(fill.amount);
      const newMakerFilled = new Big(maker.filled).plus(fillAmt);
      const makerStatus: OrderStatus = newMakerFilled.eq(maker.amount)
        ? 'Filled'
        : 'Partial';

      await this.orderModel.findByIdAndUpdate(
        maker._id as unknown as string,
        { filled: newMakerFilled.toString(), status: makerStatus },
        opts,
      );

      takerFilled = takerFilled.plus(fillAmt);

      this.logger.log(
        `Fill: ${fill.amount} @ ${fill.price} — taker ${(takerOrder._id as unknown as string).toString()} / maker ${fill.makerOrderId}`,
      );
    }

    const takerStatus: OrderStatus = takerFilled.eq(takerOrder.amount)
      ? 'Filled'
      : takerFilled.gt(0)
        ? 'Partial'
        : 'Pending';

    await this.orderModel.findByIdAndUpdate(
      takerOrder._id,
      { filled: takerFilled.toString(), status: takerStatus },
      opts,
    );
  }

  // ───────────────────────────────────────────────── Constraint Validation

  /**
   * Validate order-type-specific constraints before persisting.
   */
  private validateOrderConstraints(dto: PlaceOrderDto): void {
    if (dto.type === 'Limit' && (!dto.price || new Big(dto.price).lte(0))) {
      throw new BadRequestException('Limit orders require a positive price');
    }
    if (dto.type === 'Stop-Loss') {
      if (!dto.stopPrice || new Big(dto.stopPrice).lte(0)) {
        throw new BadRequestException(
          'Stop-Loss orders require a positive stopPrice',
        );
      }
    }
    if (new Big(dto.amount).lte(0)) {
      throw new BadRequestException('Order amount must be positive');
    }
  }
}
