import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketResolverService } from './market-resolver.service';
import { MarketsController } from './markets.controller';
import { AppCacheModule } from '../cache/cache.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketFactoryIndexerService } from './market-factory-indexer.service';
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
    MongooseModule.forFeature([
      { name: MarketRecord.name, schema: MarketSchema },
      {
        name: MarketFactoryCheckpoint.name,
        schema: MarketFactoryCheckpointSchema,
      },
    ]),
  ],
  providers: [MarketResolverService, MarketFactoryIndexerService],
  controllers: [MarketsController],
  exports: [MarketResolverService],
})
export class MarketsModule {}
