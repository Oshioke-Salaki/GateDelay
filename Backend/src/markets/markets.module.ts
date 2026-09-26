import { Module } from '@nestjs/common';
import { MarketResolverService } from './market-resolver.service';
import { MarketsController } from './markets.controller';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [AppCacheModule],
  providers: [MarketResolverService],
  controllers: [MarketsController],
  exports: [MarketResolverService],
})
export class MarketsModule {}
