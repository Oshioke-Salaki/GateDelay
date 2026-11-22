import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketMetadataService } from './market-metadata.service';
import { MarketMetadataController } from './market-metadata.controller';
import {
  MarketMetadata,
  MarketMetadataSchema,
} from './schemas/market-metadata.schema';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketMetadata.name, schema: MarketMetadataSchema },
    ]),
    AppCacheModule,
  ],
  controllers: [MarketMetadataController],
  providers: [MarketMetadataService],
  exports: [MarketMetadataService],
})
export class MarketMetadataModule {}
