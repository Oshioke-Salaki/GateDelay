export interface VolumeData {
  id: string;
  marketId: string;
  volume: number;
  timestamp: Date;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface VolumeReport {
  marketId: string;
  totalVolume: number;
  averageVolume: number;
  peakVolume: number;
  peakTime: Date;
  period: string;
  generatedAt: Date;
}

export interface VolumeTrend {
  marketId: string;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  previousPeriodVolume: number;
  currentPeriodVolume: number;
  timestamp: Date;
}

export interface VolumeRanking {
  rank: number;
  marketId: string;
  volume: number;
  marketName?: string;
  changePercent?: number;
}
