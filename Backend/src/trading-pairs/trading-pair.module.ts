import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradingPairService } from './trading-pair.service';
import { TradingPairController } from './trading-pair.controller';
import { TradingPair, TradingPairSchema } from './schemas/trading-pair.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradingPair.name, schema: TradingPairSchema },
    ]),
  ],
  controllers: [TradingPairController],
  providers: [TradingPairService],
  exports: [TradingPairService],
})
export class TradingPairModule {}
