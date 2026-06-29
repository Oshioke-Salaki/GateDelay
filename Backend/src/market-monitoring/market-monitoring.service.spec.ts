import { Test, TestingModule } from '@nestjs/testing';
import { MarketMonitoringService } from './market-monitoring.service';

describe('MarketMonitoringService', () => {
  let service: MarketMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketMonitoringService],
    }).compile();

    service = module.get<MarketMonitoringService>(MarketMonitoringService);
  });

  it('records metrics and returns health report', () => {
    service.recordMetric({
      marketId: 'market-1',
      price: 0.55,
      volume: 1000,
      spreadBps: 45,
      latencyMs: 200,
    });

    const health = service.getHealthReport('market-1');
    expect(health).toHaveLength(1);
    expect(health[0].status).toBe('HEALTHY');
  });

  it('detects anomalies and emits alerts', () => {
    const baseline = [0.5, 0.51, 0.52, 0.5, 0.49];
    baseline.forEach((price) => {
      service.recordMetric({
        marketId: 'market-2',
        price,
        volume: 1000,
        spreadBps: 40,
        latencyMs: 250,
      });
    });

    service.recordMetric({
      marketId: 'market-2',
      price: 0.9,
      volume: 1800,
      spreadBps: 180,
      latencyMs: 1600,
    });

    const alerts = service.getAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].marketId).toBe('market-2');

    const dashboard = service.getDashboard();
    expect(dashboard.marketsMonitored).toBeGreaterThan(0);
  });
});
