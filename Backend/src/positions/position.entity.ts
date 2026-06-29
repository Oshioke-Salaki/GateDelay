export type PositionSide = 'YES' | 'NO';
export type PositionStatus = 'open' | 'closed';

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  side: PositionSide;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  maxLoss: number; // risk metric: worst-case loss = costBasis
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
}
