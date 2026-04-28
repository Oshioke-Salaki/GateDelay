import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TradingPairDocument = TradingPair & Document;

export enum TradingPairStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  DELISTED = 'Delisted',
}

@Schema({ timestamps: true })
export class TradingPair {
  @Prop({ required: true })
  baseAsset: string;

  @Prop({ required: true })
  quoteAsset: string;

  @Prop({ required: true, type: Number })
  minTradeSize: number;

  @Prop({ required: true, type: Number })
  maxTradeSize: number;

  @Prop({ required: true, type: Number })
  tickSize: number;

  @Prop({ required: true, type: Number })
  pricePrecision: number;

  @Prop({ required: true, type: Number })
  amountPrecision: number;

  @Prop({
    required: true,
    enum: TradingPairStatus,
    default: TradingPairStatus.ACTIVE,
  })
  status: TradingPairStatus;

  // Statistics (stored as strings to preserve precision for math.js)
  @Prop({ type: String, default: '0' })
  volume24h: string;

  @Prop({ type: String, default: '0' })
  priceChangePercent24h: string;

  @Prop({ type: String, default: '0' })
  high24h: string;

  @Prop({ type: String, default: '0' })
  low24h: string;

  @Prop({ type: String, default: '0' })
  lastPrice: string;

  @Prop({ type: String, default: '0' })
  openPrice24h: string;
}

export const TradingPairSchema = SchemaFactory.createForClass(TradingPair);

// Compound index to ensure uniqueness of base/quote pair
TradingPairSchema.index({ baseAsset: 1, quoteAsset: 1 }, { unique: true });
