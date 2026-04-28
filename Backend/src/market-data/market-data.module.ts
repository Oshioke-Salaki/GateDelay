import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [HttpModule, AppCacheModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
