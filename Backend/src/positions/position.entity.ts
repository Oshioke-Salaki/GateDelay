export type PositionSide = 'YES' | 'NO';
export type PositionStatus = 'open' | 'closed';

/** Decimal API values are strings; prices always refer to the held outcome. */
export interface Position {
  id: string;
  userId: string;
  account: string;
  chainId: string;
  marketId: string;
  side: PositionSide;
  shares: string;
  entryPrice: string;
  currentPrice: string;
  costBasis: string;
  pnl: string;
  realizedPnl: string;
  pnlPct: string;
  maxLoss: string;
  status: PositionStatus;
  openedAt: Date;
  closedAt?: Date;
}
