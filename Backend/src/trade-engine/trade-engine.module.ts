import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeEngineService } from './trade-engine.service';
import { TradeEngineController } from './trade-engine.controller';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [TradeEngineController],
  providers: [TradeEngineService],
  exports: [TradeEngineService],
})
export class TradeEngineModule {}
