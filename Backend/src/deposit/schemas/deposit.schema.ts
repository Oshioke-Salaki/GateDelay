import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepositDocument = Deposit & Document;

export enum DepositStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum ConfirmationLevel {
  INSTANT = 0,      // 0 confirmations (risky)
  FAST = 1,         // 1 confirmation
  STANDARD = 3,     // 3 confirmations
  SECURE = 6,       // 6 confirmations
  VERY_SECURE = 12, // 12 confirmations
}

@Schema({ timestamps: true })
export class Deposit {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true, unique: true })
  txHash: string;

  @Prop({ required: true })
  fromAddress: string;

  @Prop({ required: true })
  toAddress: string;

  @Prop({ required: true })
  amount: string;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  network: string;

  @Prop({
    type: String,
    enum: Object.values(DepositStatus),
    default: DepositStatus.PENDING,
    index: true,
  })
  status: DepositStatus;

  @Prop({ default: 0 })
  confirmations: number;

  @Prop({
    type: Number,
    enum: Object.values(ConfirmationLevel).filter((v) => typeof v === "number"),
    default: ConfirmationLevel.STANDARD,
  })
  requiredConfirmations: ConfirmationLevel;

  @Prop()
  blockNumber?: number;

  @Prop()
  blockHash?: string;

  @Prop()
  gasUsed?: string;

  @Prop()
  gasPrice?: string;

  @Prop({ default: false })
  balanceUpdated: boolean;

  @Prop({ default: false })
  notificationSent: boolean;

  @Prop()
  confirmedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  errorMessage?: string;
}

export const DepositSchema = SchemaFactory.createForClass(Deposit);

// Indexes for efficient queries
DepositSchema.index({ userId: 1, status: 1 });
DepositSchema.index({ status: 1, confirmations: 1 });
DepositSchema.index({ createdAt: -1 });
DepositSchema.index({ expiresAt: 1 }, { sparse: true });
