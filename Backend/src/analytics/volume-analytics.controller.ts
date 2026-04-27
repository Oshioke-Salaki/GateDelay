import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { VolumeAnalyticsService } from './volume-analytics.service';

@Controller('analytics/volume')
export class VolumeAnalyticsController {
  constructor(private readonly volumeAnalyticsService: VolumeAnalyticsService) {}

  @Post('record')
  recordVolume(
    @Body() body: { marketId: string; volume: number; period?: 'hourly' | 'daily' | 'weekly' | 'monthly' },
  ) {
    return this.volumeAnalyticsService.recordVolume(body.marketId, body.volume, body.period);
  }

  @Get('report')
  getVolumeReport(@Query('marketId') marketId: string, @Query('periodHours') periodHours: string = '24') {
    const report = this.volumeAnalyticsService.generateVolumeReport(marketId, parseInt(periodHours));
    return report;
  }

  @Get('trends')
  getVolumeTrends(@Query('marketId') marketId: string, @Query('periodHours') periodHours: string = '24') {
    return this.volumeAnalyticsService.analyzeTrends(marketId, parseInt(periodHours));
  }

  @Get('rankings')
  getVolumeRankings(@Query('limit') limit: string = '10', @Query('periodHours') periodHours: string = '24') {
    return this.volumeAnalyticsService.getVolumeRankings(parseInt(limit), parseInt(periodHours));
  }

  @Get('filter')
  getVolumeByTimeFilter(
    @Query('marketId') marketId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.volumeAnalyticsService.getVolumeByTimeFilter(marketId, new Date(startDate), new Date(endDate));
  }
}
