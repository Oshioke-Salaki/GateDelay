import { Module } from '@nestjs/common';
import { TradingHistoryService } from './trading-history.service';
import { TradingHistoryController } from './trading-history.controller';

@Module({
  providers: [TradingHistoryService],
  controllers: [TradingHistoryController],
  exports: [TradingHistoryService],
})
export class TradingHistoryModule {}
