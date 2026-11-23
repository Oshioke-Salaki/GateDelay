import { Schema } from 'mongoose';

export interface StoredPosition {
  id: string;
  userId: string;
  account: string;
  chainId: string;
  contract: string;
  marketId: string;
  side: 'YES' | 'NO';
  shareUnits: string;
  costUnits: string;
  realizedUnits: string;
  priceUnits: string;
  lastBlock: number;
  lastLog: number;
  openedAt: Date;
  closedAt?: Date;
}
export const PositionSchema = new Schema<StoredPosition>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  account: { type: String, required: true },
  chainId: { type: String, required: true },
  contract: { type: String, required: true },
  marketId: { type: String, required: true },
  side: { type: String, enum: ['YES', 'NO'], required: true },
  shareUnits: { type: String, required: true },
  costUnits: { type: String, required: true },
  realizedUnits: { type: String, required: true },
  priceUnits: { type: String, required: true },
  lastBlock: { type: Number, required: true },
  lastLog: { type: Number, required: true },
  openedAt: { type: Date, required: true },
  closedAt: Date,
});
PositionSchema.index({ account: 1, chainId: 1, contract: 1, marketId: 1, side: 1 }, { unique: true });

export interface AppliedExecution {
  key: string;
  positionId: string;
  blockHash: string;
  shareUnits: string;
  collateralUnits: string;
  action: string;
}
export const AppliedExecutionSchema = new Schema<AppliedExecution>({
  key: { type: String, required: true, unique: true },
  positionId: { type: String, required: true },
  blockHash: { type: String, required: true },
  shareUnits: { type: String, required: true },
  collateralUnits: { type: String, required: true },
  action: { type: String, required: true },
});
