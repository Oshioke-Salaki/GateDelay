import { Schema } from 'mongoose';

export interface StoredPortfolioSnapshot {
  userId: string;
  timestamp: Date;
  totalCost: string;
  totalPnl: string;
  totalPnlPct: string;
}

export const PortfolioSnapshotSchema = new Schema<StoredPortfolioSnapshot>(
  {
    userId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now },
    totalCost: { type: String, required: true },
    totalPnl: { type: String, required: true },
    totalPnlPct: { type: String, required: true },
  },
  { timestamps: false },
);

// Efficient range queries for historical-return calculations
PortfolioSnapshotSchema.index({ userId: 1, timestamp: -1 });
