import { Module } from '@nestjs/common';
import { MarketResolverService } from './market-resolver.service';
import { MarketsController } from './markets.controller';

@Module({
  providers: [MarketResolverService],
  controllers: [MarketsController],
  exports: [MarketResolverService],
})
export class MarketsModule {}
