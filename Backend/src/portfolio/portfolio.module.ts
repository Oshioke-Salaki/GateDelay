import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PositionsModule } from '../positions/positions.module';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [PositionsModule, AppCacheModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
