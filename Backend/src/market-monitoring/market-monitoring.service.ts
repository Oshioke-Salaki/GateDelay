import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { MarketHealth, MarketMetric, MonitoringAlert } from './market-monitoring.entity';

@Injectable()
export class MarketMonitoringService {
  private readonly metrics = new Map<string, MarketMetric[]>();
  private readonly alerts: MonitoringAlert[] = [];

  recordMetric(input: Omit<MarketMetric, 'capturedAt'>): MarketMetric {
    const metric: MarketMetric = {
      ...input,
      capturedAt: new Date().toISOString(),
    };

    if (!this.metrics.has(metric.marketId)) {
      this.metrics.set(metric.marketId, []);
    }
    this.metrics.get(metric.marketId)?.push(metric);

    this.pruneOldMetrics(metric.marketId);
    this.evaluateMetric(metric.marketId, metric);

    return metric;
  }

  getHealthReport(marketId?: string): MarketHealth[] {
    const ids = marketId ? [marketId] : Array.from(this.metrics.keys());

    return ids
      .map((id) => this.buildHealth(id))
      .filter((item): item is MarketHealth => Boolean(item));
  }

  getDashboard() {
    const health = this.getHealthReport();
    const critical = health.filter((entry) => entry.status === 'CRITICAL').length;
    const degraded = health.filter((entry) => entry.status === 'DEGRADED').length;

    return {
      marketsMonitored: health.length,
      criticalMarkets: critical,
      degradedMarkets: degraded,
      activeAlerts: this.alerts.slice(0, 50),
      health,
    };
  }

  getAlerts(limit = 100): MonitoringAlert[] {
    return this.alerts.slice(0, limit);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  runHealthChecks() {
    const health = this.getHealthReport();

    health.forEach((entry) => {
      if (entry.status === 'CRITICAL') {
        this.pushAlert({
          marketId: entry.marketId,
          severity: 'CRITICAL',
          type: 'HEALTH',
          message: `Market ${entry.marketId} is in CRITICAL state`,
        });
      }
    });
  }

  private buildHealth(marketId: string): MarketHealth | null {
    const series = this.metrics.get(marketId);
    if (!series || !series.length) {
      return null;
    }

    const latest = series[series.length - 1];
    const anomalies = this.detectRecentAnomalies(marketId);

    let status: MarketHealth['status'] = 'HEALTHY';
    if (latest.latencyMs > 1500 || latest.spreadBps > 250 || anomalies >= 3) {
      status = 'CRITICAL';
    } else if (latest.latencyMs > 700 || latest.spreadBps > 120 || anomalies > 0) {
      status = 'DEGRADED';
    }

    return {
      marketId,
      status,
      latestPrice: latest.price,
      latestVolume: latest.volume,
      latestSpreadBps: latest.spreadBps,
      latestLatencyMs: latest.latencyMs,
      anomalyCountLastHour: anomalies,
      updatedAt: latest.capturedAt,
    };
  }

  private evaluateMetric(marketId: string, latest: MarketMetric) {
    const series = this.metrics.get(marketId) ?? [];
    if (series.length < 6) {
      return;
    }

    const historical = series.slice(-6, -1);
    const avgPrice =
      historical.reduce((sum, point) => sum + point.price, 0) / historical.length;
    const avgVolume =
      historical.reduce((sum, point) => sum + point.volume, 0) / historical.length;

    const priceMove = avgPrice === 0 ? 0 : Math.abs((latest.price - avgPrice) / avgPrice);
    const volumeMove =
      avgVolume === 0 ? 0 : Math.abs((latest.volume - avgVolume) / avgVolume);

    if (priceMove > 0.2 || volumeMove > 0.5) {
      this.pushAlert({
        marketId,
        severity: priceMove > 0.35 ? 'CRITICAL' : 'WARNING',
        type: 'ANOMALY',
        message: `Anomaly detected for ${marketId}: price change ${(priceMove * 100).toFixed(2)}%, volume change ${(volumeMove * 100).toFixed(2)}%`,
      });
    }

    if (latest.latencyMs > 1000) {
      this.pushAlert({
        marketId,
        severity: latest.latencyMs > 2000 ? 'CRITICAL' : 'WARNING',
        type: 'HEALTH',
        message: `High data latency detected for ${marketId}: ${latest.latencyMs}ms`,
      });
    }
  }

  private detectRecentAnomalies(marketId: string): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.alerts.filter(
      (alert) =>
        alert.marketId === marketId &&
        alert.type === 'ANOMALY' &&
        new Date(alert.createdAt).getTime() >= oneHourAgo,
    ).length;
  }

  private pushAlert(input: Omit<MonitoringAlert, 'id' | 'createdAt'>) {
    this.alerts.unshift({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });

    if (this.alerts.length > 500) {
      this.alerts.length = 500;
    }
  }

  private pruneOldMetrics(marketId: string) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = (this.metrics.get(marketId) ?? []).filter(
      (point) => new Date(point.capturedAt).getTime() >= oneDayAgo,
    );
    this.metrics.set(marketId, filtered);
  }
}
