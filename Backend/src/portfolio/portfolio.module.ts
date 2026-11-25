import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioSnapshotScheduler } from './portfolio-snapshot.scheduler';
import { PortfolioSnapshotSchema } from './portfolio-snapshot.schema';
import { PositionsModule } from '../positions/positions.module';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [
    PositionsModule,
    AppCacheModule,
    MongooseModule.forFeature([
      { name: 'PortfolioSnapshot', schema: PortfolioSnapshotSchema },
    ]),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioSnapshotScheduler],
  exports: [PortfolioService],
})
export class PortfolioModule {}
