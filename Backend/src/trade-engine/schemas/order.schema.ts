import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

export type OrderType = 'Market' | 'Limit' | 'Stop-Loss';
export type OrderSide = 'Buy' | 'Sell';
export type OrderStatus = 'Pending' | 'Partial' | 'Filled' | 'Canceled';
export type OrderExecutionType = 'CLOB';
export type OrderSettlementStatus = 'NOT_ON_CHAIN';

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  venueId: string;

  @Prop({ required: true, enum: ['CLOB'], default: 'CLOB' })
  executionType: OrderExecutionType;

  @Prop({ required: true, enum: ['NOT_ON_CHAIN'], default: 'NOT_ON_CHAIN' })
  settlementStatus: OrderSettlementStatus;

  @Prop({ required: true, enum: ['Market', 'Limit', 'Stop-Loss'] })
  type: OrderType;

  @Prop({ required: true, enum: ['Buy', 'Sell'] })
  side: OrderSide;

  @Prop({ required: true })
  pair: string;

  /** Limit / Stop-Loss price as string for big.js precision */
  @Prop({ default: '0' })
  price: string;

  /** Stop trigger price (Stop-Loss only) */
  @Prop({ default: '0' })
  stopPrice: string;

  /** Original order amount */
  @Prop({ required: true })
  amount: string;

  /** Cumulative filled amount */
  @Prop({ default: '0' })
  filled: string;

  @Prop({
    default: 'Pending',
    enum: ['Pending', 'Partial', 'Filled', 'Canceled'],
  })
  status: OrderStatus;

  /** Placed-at timestamp for Price-Time priority */
  @Prop({ default: () => new Date() })
  timestamp: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes for efficient order-book queries
OrderSchema.index({
  venueId: 1,
  pair: 1,
  side: 1,
  status: 1,
  price: 1,
  timestamp: 1,
});
OrderSchema.index({ userId: 1, status: 1 });
