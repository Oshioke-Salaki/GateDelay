import Big from 'big.js';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';

export interface Order {
  id: string;
  userId: string;
  marketId: string;
  side: OrderSide;
  /** Outcome being traded: YES or NO share */
  outcome: 'YES' | 'NO';
  /** Limit price per share (0–1) */
  price: Big;
  /** Original quantity */
  quantity: Big;
  /** Remaining unfilled quantity */
  remaining: Big;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Fill {
  orderId: string;
  counterOrderId: string;
  quantity: Big;
  price: Big;
  filledAt: Date;
}
