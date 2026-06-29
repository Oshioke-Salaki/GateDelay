import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { HealthQueryDto, RecordMetricDto } from './dto/market-monitoring.dto';
import { MarketMonitoringService } from './market-monitoring.service';

@Controller('market-monitoring')
export class MarketMonitoringController {
  constructor(
    private readonly marketMonitoringService: MarketMonitoringService,
  ) {}

  @Post('metrics')
  recordMetric(@Body() body: RecordMetricDto) {
    return this.marketMonitoringService.recordMetric(body);
  }

  @Get('health')
  getHealth(@Query() query: HealthQueryDto) {
    return this.marketMonitoringService.getHealthReport(query.marketId);
  }

  @Get('alerts')
  getAlerts(@Query('limit') limit?: string) {
    return this.marketMonitoringService.getAlerts(limit ? Number(limit) : undefined);
  }

  @Get('dashboard')
  getDashboard() {
    return this.marketMonitoringService.getDashboard();
  }
}
