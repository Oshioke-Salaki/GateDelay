import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PortfolioService } from './portfolio.service';

@Injectable()
export class PortfolioSnapshotScheduler {
  private readonly logger = new Logger(PortfolioSnapshotScheduler.name);

  constructor(private readonly portfolioService: PortfolioService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async captureHourlySnapshots(): Promise<void> {
    const userIds = await this.portfolioService.getActiveUserIds();
    if (!userIds.length) return;

    const results = await Promise.allSettled(
      userIds.map((id) => this.portfolioService.recordSnapshot(id)),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(
      `Portfolio snapshots: ${results.length - failed} captured, ${failed} failed`,
    );
  }
}
