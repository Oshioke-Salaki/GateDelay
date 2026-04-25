export type TradeType = 'buy' | 'sell' | 'redeem' | 'deposit' | 'withdraw';
export type TradeStatus = 'pending' | 'confirmed' | 'failed';

export interface Trade {
    id: string;
    userId: string;
    marketId: string;
    type: TradeType;
    side?: 'YES' | 'NO'; // Only for buy/sell
    shares?: number;
    amount: number;
    price?: number; // Entry price for buy/sell
    status: TradeStatus;
    txHash?: string;
    pnl?: number; // Realized P&L for sell/redeem
    pnlPct?: number;
    createdAt: Date;
    confirmedAt?: Date;
    failureReason?: string;
}

export interface TradePerformanceMetrics {
    totalTrades: number;
    totalVolume: number;
    totalPnl: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number; // totalWins / totalLosses
}
