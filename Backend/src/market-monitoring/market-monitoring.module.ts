import { Module } from '@nestjs/common';
import { MarketMonitoringController } from './market-monitoring.controller';
import { MarketMonitoringService } from './market-monitoring.service';

@Module({
  controllers: [MarketMonitoringController],
  providers: [MarketMonitoringService],
  exports: [MarketMonitoringService],
})
export class MarketMonitoringModule {}
