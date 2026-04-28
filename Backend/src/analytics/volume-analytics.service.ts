import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  VolumeData,
  VolumeReport,
  VolumeTrend,
  VolumeRanking,
} from './volume-analytics.entity';

@Injectable()
export class VolumeAnalyticsService {
  private volumeData = new Map<string, VolumeData[]>();
  private volumeReports = new Map<string, VolumeReport[]>();
  private volumeTrends = new Map<string, VolumeTrend[]>();

  recordVolume(
    marketId: string,
    volume: number,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'hourly',
  ): VolumeData {
    const data: VolumeData = {
      id: uuidv4(),
      marketId,
      volume,
      timestamp: new Date(),
      period,
    };

    if (!this.volumeData.has(marketId)) {
      this.volumeData.set(marketId, []);
    }
    this.volumeData.get(marketId)!.push(data);
    return data;
  }

  generateVolumeReport(
    marketId: string,
    periodHours: number = 24,
  ): VolumeReport {
    const data = this.volumeData.get(marketId) || [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

    const relevantData = data.filter((d) => d.timestamp >= cutoff);

    if (relevantData.length === 0) {
      return {
        marketId,
        totalVolume: 0,
        averageVolume: 0,
        peakVolume: 0,
        peakTime: now,
        period: `${periodHours}h`,
        generatedAt: now,
      };
    }

    const totalVolume = relevantData.reduce((sum, d) => sum + d.volume, 0);
    const averageVolume = totalVolume / relevantData.length;
    const peakData = relevantData.reduce((max, d) =>
      d.volume > max.volume ? d : max,
    );

    const report: VolumeReport = {
      marketId,
      totalVolume,
      averageVolume,
      peakVolume: peakData.volume,
      peakTime: peakData.timestamp,
      period: `${periodHours}h`,
      generatedAt: now,
    };

    if (!this.volumeReports.has(marketId)) {
      this.volumeReports.set(marketId, []);
    }
    this.volumeReports.get(marketId)!.push(report);

    return report;
  }

  analyzeTrends(marketId: string, periodHours: number = 24): VolumeTrend {
    const data = this.volumeData.get(marketId) || [];
    const now = new Date();
    const currentCutoff = new Date(
      now.getTime() - periodHours * 60 * 60 * 1000,
    );
    const previousCutoff = new Date(
      now.getTime() - periodHours * 2 * 60 * 60 * 1000,
    );

    const currentData = data.filter((d) => d.timestamp >= currentCutoff);
    const previousData = data.filter(
      (d) => d.timestamp >= previousCutoff && d.timestamp < currentCutoff,
    );

    const currentVolume = currentData.reduce((sum, d) => sum + d.volume, 0);
    const previousVolume = previousData.reduce((sum, d) => sum + d.volume, 0);

    const percentageChange =
      previousVolume > 0
        ? ((currentVolume - previousVolume) / previousVolume) * 100
        : 0;
    const trend =
      percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable';

    const volumeTrend: VolumeTrend = {
      marketId,
      trend,
      percentageChange,
      previousPeriodVolume: previousVolume,
      currentPeriodVolume: currentVolume,
      timestamp: now,
    };

    if (!this.volumeTrends.has(marketId)) {
      this.volumeTrends.set(marketId, []);
    }
    this.volumeTrends.get(marketId)!.push(volumeTrend);

    return volumeTrend;
  }

  getVolumeRankings(
    limit: number = 10,
    periodHours: number = 24,
  ): VolumeRanking[] {
    const rankings: VolumeRanking[] = [];

    for (const [marketId, data] of this.volumeData.entries()) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
      const relevantData = data.filter((d) => d.timestamp >= cutoff);
      const volume = relevantData.reduce((sum, d) => sum + d.volume, 0);

      rankings.push({
        marketId,
        volume,
        rank: 0,
      });
    }

    rankings.sort((a, b) => b.volume - a.volume);
    rankings.forEach((r, i) => (r.rank = i + 1));

    return rankings.slice(0, limit);
  }

  getVolumeByTimeFilter(
    marketId: string,
    startDate: Date,
    endDate: Date,
  ): VolumeData[] {
    const data = this.volumeData.get(marketId) || [];
    return data.filter(
      (d) => d.timestamp >= startDate && d.timestamp <= endDate,
    );
  }

  getVolumeReport(marketId: string): VolumeReport | undefined {
    const reports = this.volumeReports.get(marketId);
    return reports ? reports[reports.length - 1] : undefined;
  }

  getVolumeTrend(marketId: string): VolumeTrend | undefined {
    const trends = this.volumeTrends.get(marketId);
    return trends ? trends[trends.length - 1] : undefined;
  }
}
