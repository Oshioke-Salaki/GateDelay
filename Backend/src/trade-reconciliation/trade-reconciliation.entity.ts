export interface SourceTrade {
  tradeId: string;
  marketId: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

export interface TradeDiscrepancy {
  tradeId: string;
  sources: string[];
  fields: string[];
  valuesBySource: Record<string, SourceTrade>;
  resolutionStatus: 'OPEN' | 'RESOLVED';
  resolutionNote?: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface ReconciliationReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  comparedTrades: number;
  discrepanciesFound: number;
  resolvedCount: number;
  unresolvedCount: number;
}
