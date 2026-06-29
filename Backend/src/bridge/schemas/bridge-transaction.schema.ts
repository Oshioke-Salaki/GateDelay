import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BridgeTransactionDocument = BridgeTransaction & Document;

export enum BridgeStatus {
  PENDING = 'pending',
  APPROVING = 'approving',
  BRIDGING = 'bridging',
  CONFIRMING = 'confirming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum BridgeProtocol {
  STARGATE = 'stargate',
  ACROSS = 'across',
  HOP = 'hop',
  CBRIDGE = 'cbridge',
  SOCKET = 'socket',
}

@Schema({ timestamps: true })
export class BridgeTransaction {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(BridgeProtocol),
  })
  protocol: BridgeProtocol;

  @Prop({ required: true })
  fromChainId: number;

  @Prop({ required: true })
  toChainId: number;

  @Prop({ required: true })
  fromChainName: string;

  @Prop({ required: true })
  toChainName: string;

  @Prop({ required: true })
  tokenSymbol: string;

  @Prop({ required: true })
  tokenAddress: string;

  /** Amount as string for precision */
  @Prop({ required: true })
  amount: string;

  /** Amount received on destination chain */
  @Prop()
  receivedAmount?: string;

  @Prop({ required: true })
  senderAddress: string;

  @Prop({ required: true })
  recipientAddress: string;

  @Prop({
    type: String,
    enum: Object.values(BridgeStatus),
    default: BridgeStatus.PENDING,
    index: true,
  })
  status: BridgeStatus;

  /** Source chain transaction hash */
  @Prop({ index: true })
  sourceTxHash?: string;

  /** Destination chain transaction hash */
  @Prop({ index: true })
  destinationTxHash?: string;

  /** Bridge-internal transfer ID (protocol-specific) */
  @Prop({ index: true })
  bridgeTransferId?: string;

  @Prop({ default: 0 })
  sourceConfirmations: number;

  @Prop({ default: 0 })
  destinationConfirmations: number;

  /** Fee paid to bridge protocol (in tokenSymbol) */
  @Prop({ default: '0' })
  bridgeFee: string;

  /** Gas cost on source chain */
  @Prop({ default: '0' })
  gasFee: string;

  @Prop()
  estimatedArrivalTime?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  failedAt?: Date;

  @Prop()
  refundedAt?: Date;

  @Prop()
  errorMessage?: string;

  /** Security: slippage tolerance in basis points */
  @Prop({ default: 50 })
  slippageBps: number;

  /** Security: max fee willing to pay in USD */
  @Prop({ default: '10' })
  maxFeeUsd: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const BridgeTransactionSchema =
  SchemaFactory.createForClass(BridgeTransaction);

BridgeTransactionSchema.index({ userId: 1, status: 1 });
BridgeTransactionSchema.index({ userId: 1, createdAt: -1 });
BridgeTransactionSchema.index({ sourceTxHash: 1 }, { sparse: true });
BridgeTransactionSchema.index({ destinationTxHash: 1 }, { sparse: true });
BridgeTransactionSchema.index({
  status: 1,
  estimatedArrivalTime: 1,
});
