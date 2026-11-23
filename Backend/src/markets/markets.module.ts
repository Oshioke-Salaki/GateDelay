import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketResolverService } from './market-resolver.service';
import { MarketsController } from './markets.controller';
import { AppCacheModule } from '../cache/cache.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketFactoryIndexerService } from './market-factory-indexer.service';
import { MarketMakerQuoteService } from './market-maker-quote.service';
import { MarketMakerMetricsService } from './market-maker-metrics.service';
import { MarketDataModule } from '../market-data/market-data.module';
import {
  MarketFactoryCheckpoint,
  MarketFactoryCheckpointSchema,
  MarketRecord,
  MarketSchema,
} from './schemas/market.schema';

@Module({
  imports: [
    AppCacheModule,
    BlockchainModule,
    MarketDataModule,
    MongooseModule.forFeature([
      { name: MarketRecord.name, schema: MarketSchema },
      {
        name: MarketFactoryCheckpoint.name,
        schema: MarketFactoryCheckpointSchema,
      },
    ]),
  ],
  providers: [
    MarketResolverService,
    MarketFactoryIndexerService,
    MarketMakerQuoteService,
    MarketMakerMetricsService,
  ],
  controllers: [MarketsController],
  exports: [MarketResolverService],
})
export class MarketsModule {}
