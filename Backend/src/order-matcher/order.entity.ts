import Big from 'big.js';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';

export interface Order {
  id: string;
  userId: string;
  venueId: string;
  executionType: 'CLOB';
  settlementStatus: 'NOT_ON_CHAIN';
  pair: string;
  side: OrderSide;
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
  venueId: string;
  pair: string;
  executionType: 'CLOB';
  settlementStatus: 'NOT_ON_CHAIN';
  quantity: Big;
  price: Big;
  filledAt: Date;
}
