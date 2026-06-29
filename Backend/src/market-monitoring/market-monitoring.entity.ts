export interface MarketMetric {
  marketId: string;
  price: number;
  volume: number;
  spreadBps: number;
  latencyMs: number;
  capturedAt: string;
}

export interface MonitoringAlert {
  id: string;
  marketId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'ANOMALY' | 'HEALTH';
  message: string;
  createdAt: string;
}

export interface MarketHealth {
  marketId: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  latestPrice: number;
  latestVolume: number;
  latestSpreadBps: number;
  latestLatencyMs: number;
  anomalyCountLastHour: number;
  updatedAt: string;
}
