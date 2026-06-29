import { Module } from '@nestjs/common';
import { VolumeAnalyticsService } from './volume-analytics.service';
import { VolumeAnalyticsController } from './volume-analytics.controller';

@Module({
  controllers: [VolumeAnalyticsController],
  providers: [VolumeAnalyticsService],
  exports: [VolumeAnalyticsService],
})
export class AnalyticsModule {}
