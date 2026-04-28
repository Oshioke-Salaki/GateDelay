import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Big from 'big.js';
import { Order, Fill, OrderSide } from './order.entity';
import { PlaceOrderDto } from './order.dto';

/**
 * In-memory order book keyed by `${marketId}:${outcome}`.
 * Each side is a price-time priority queue (array kept sorted on insert).
 *
 * Atomicity: a per-book async mutex (promise chain) ensures only one
 * matching operation runs at a time per book, preventing race conditions.
 */
@Injectable()
export class OrderMatcherService {
  private readonly logger = new Logger(OrderMatcherService.name);

  /** bids[bookKey] = BUY orders sorted desc by price, then asc by createdAt */
  private readonly bids = new Map<string, Order[]>();
  /** asks[bookKey] = SELL orders sorted asc by price, then asc by createdAt */
  private readonly asks = new Map<string, Order[]>();
  /** All orders by id */
  private readonly orders = new Map<string, Order>();
  /** Fill history */
  private readonly fills: Fill[] = [];
  /** Per-book mutex: a promise chain that serialises matching */
  private readonly locks = new Map<string, Promise<void>>();

  // ── Public API ──────────────────────────────────────────────────────────────

  async placeOrder(userId: string, dto: PlaceOrderDto): Promise<Order> {
    const order: Order = {
      id: uuidv4(),
      userId,
      marketId: dto.marketId,
      side: dto.side,
      outcome: dto.outcome,
      price: new Big(dto.price),
      quantity: new Big(dto.quantity),
      remaining: new Big(dto.quantity),
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);
    this.logger.log(
      `Order placed: ${order.id} ${order.side} ${order.quantity} @ ${order.price}`,
    );

    await this.withLock(this.bookKey(order), () => this.matchOrder(order));
    return order;
  }

  cancelOrder(userId: string, orderId: string): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId)
      throw new BadRequestException('Not your order');
    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    order.status = 'CANCELLED';
    order.updatedAt = new Date();
    this.removeFromBook(order);
    return order;
  }

  getOrderBook(marketId: string, outcome: 'YES' | 'NO') {
    const key = `${marketId}:${outcome}`;
    return {
      bids: (this.bids.get(key) ?? []).map(this.toView),
      asks: (this.asks.get(key) ?? []).map(this.toView),
    };
  }

  getOrder(orderId: string): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  getUserOrders(userId: string): Order[] {
    return [...this.orders.values()].filter((o) => o.userId === userId);
  }

  getFills(orderId: string): Fill[] {
    return this.fills.filter(
      (f) => f.orderId === orderId || f.counterOrderId === orderId,
    );
  }

  // ── Matching engine ─────────────────────────────────────────────────────────

  private matchOrder(incoming: Order): void {
    const key = this.bookKey(incoming);
    const counterBook = incoming.side === 'BUY' ? this.asks : this.bids;
    const resting = counterBook.get(key) ?? [];

    while (incoming.remaining.gt(0) && resting.length > 0) {
      const best = resting[0];

      // Price compatibility: BUY price >= SELL price
      const compatible =
        incoming.side === 'BUY'
          ? incoming.price.gte(best.price)
          : incoming.price.lte(best.price);

      if (!compatible) break;

      // Fill quantity = min of both remainders
      const fillQty = incoming.remaining.lte(best.remaining)
        ? incoming.remaining
        : best.remaining;

      // Execution price = resting order's price (maker price)
      const fillPrice = best.price;

      this.applyFill(incoming, best, fillQty, fillPrice);

      if (best.remaining.eq(0)) {
        resting.shift(); // fully filled — remove from book
      }
    }

    // If still has remaining quantity, add to own side of the book
    if (incoming.remaining.gt(0) && incoming.status !== 'CANCELLED') {
      this.addToBook(incoming);
    }
  }

  private applyFill(taker: Order, maker: Order, qty: Big, price: Big): void {
    taker.remaining = taker.remaining.minus(qty);
    maker.remaining = maker.remaining.minus(qty);
    taker.updatedAt = maker.updatedAt = new Date();

    taker.status = taker.remaining.eq(0) ? 'FILLED' : 'PARTIAL';
    maker.status = maker.remaining.eq(0) ? 'FILLED' : 'PARTIAL';

    const fill: Fill = {
      orderId: taker.id,
      counterOrderId: maker.id,
      quantity: qty,
      price,
      filledAt: new Date(),
    };
    this.fills.push(fill);

    this.logger.log(
      `Fill: ${qty.toFixed(4)} @ ${price.toFixed(4)} — taker ${taker.id} / maker ${maker.id}`,
    );
  }

  // ── Book management ─────────────────────────────────────────────────────────

  private addToBook(order: Order): void {
    const key = this.bookKey(order);
    if (order.side === 'BUY') {
      const book = this.bids.get(key) ?? [];
      this.insertSorted(book, order, 'desc');
      this.bids.set(key, book);
    } else {
      const book = this.asks.get(key) ?? [];
      this.insertSorted(book, order, 'asc');
      this.asks.set(key, book);
    }
  }

  private removeFromBook(order: Order): void {
    const key = this.bookKey(order);
    const book = order.side === 'BUY' ? this.bids.get(key) : this.asks.get(key);
    if (!book) return;
    const idx = book.findIndex((o) => o.id === order.id);
    if (idx !== -1) book.splice(idx, 1);
  }

  /**
   * Insert into a sorted array maintaining price-time priority.
   * direction='desc' → highest price first (bids); 'asc' → lowest price first (asks).
   * Ties broken by createdAt ascending (FIFO).
   */
  private insertSorted(
    book: Order[],
    order: Order,
    direction: 'asc' | 'desc',
  ): void {
    let lo = 0;
    let hi = book.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const cmp = order.price.cmp(book[mid].price);
      const before =
        direction === 'desc'
          ? cmp > 0 || (cmp === 0 && order.createdAt < book[mid].createdAt)
          : cmp < 0 || (cmp === 0 && order.createdAt < book[mid].createdAt);
      if (before) hi = mid;
      else lo = mid + 1;
    }
    book.splice(lo, 0, order);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private bookKey(order: Order): string {
    return `${order.marketId}:${order.outcome}`;
  }

  /** Serialise matching per book to guarantee atomicity */
  private withLock(key: string, fn: () => void): Promise<void> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.locks.set(
      key,
      next.catch(() => {}),
    ); // don't let errors break the chain
    return next;
  }

  private toView = (o: Order) => ({
    id: o.id,
    price: o.price.toFixed(4),
    remaining: o.remaining.toFixed(4),
    createdAt: o.createdAt,
  });
}
