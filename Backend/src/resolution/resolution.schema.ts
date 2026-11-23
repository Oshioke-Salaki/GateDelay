import { Schema } from 'mongoose';
import type { MarketResolution, ResolutionConfirmation, ResolutionDispute } from './resolution.entity';

// One aggregate makes a transition and its evidence/dispute history atomic,
// including on MongoDB installations without replica-set transactions.
export interface StoredResolution extends MarketResolution {
  active: boolean;
  revision: number;
  confirmations: ResolutionConfirmation[];
  disputes: ResolutionDispute[];
}
export const RESOLUTION_MODEL = 'ResolutionWorkflow';
const confirmation = new Schema({
  id: { type: String, required: true }, resolutionId: { type: String, required: true },
  marketId: { type: String, required: true }, attempt: { type: Number, required: true },
  outcome: { type: String, enum: ['YES', 'NO', 'INVALID'], required: true },
  confirmedBy: { type: String, required: true }, txHash: { type: String, required: true },
  blockNumber: { type: Number, required: true }, blockHash: { type: String, required: true },
  chainId: { type: Number, required: true }, contractAddress: { type: String, required: true },
  logIndex: { type: Number, required: true }, confirmedAt: { type: Date, required: true },
  invalidatedAt: Date,
}, { _id: false });
const dispute = new Schema({
  id: { type: String, required: true }, resolutionId: { type: String, required: true },
  marketId: { type: String, required: true }, attempt: { type: Number, required: true },
  priorStatus: { type: String, enum: ['requested', 'confirmed'], required: true },
  disputedBy: { type: String, required: true }, reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'under_review', 'upheld', 'rejected'], required: true },
  reviewNotes: String, raisedAt: { type: Date, required: true }, reviewedAt: Date, resolvedAt: Date,
}, { _id: false });
export const ResolutionSchema = new Schema<StoredResolution>({
  id: { type: String, required: true, unique: true },
  marketId: { type: String, required: true }, attempt: { type: Number, required: true, min: 1 },
  active: { type: Boolean, required: true }, revision: { type: Number, required: true },
  requestedBy: { type: String, required: true },
  outcome: { type: String, required: true, enum: ['YES', 'NO', 'INVALID'] },
  status: { type: String, required: true, enum: ['pending', 'requested', 'confirmed', 'disputed', 'resolved', 'cancelled'] },
  evidence: String, txHash: String, requestedAt: { type: Date, required: true },
  confirmedAt: Date, resolvedAt: Date, cancelledAt: Date,
  confirmations: { type: [confirmation], default: [] }, disputes: { type: [dispute], default: [] },
}, { collection: 'resolution_workflows', versionKey: false });
ResolutionSchema.index({ marketId: 1 }, { unique: true, partialFilterExpression: { active: true } });
ResolutionSchema.index({ marketId: 1, attempt: 1 }, { unique: true });
// Evidence remains reserved even when invalidated, preventing replay in a replacement attempt.
ResolutionSchema.index({ 'confirmations.chainId': 1, 'confirmations.txHash': 1, 'confirmations.logIndex': 1 },
  { unique: true, partialFilterExpression: { 'confirmations.txHash': { $exists: true } } });
