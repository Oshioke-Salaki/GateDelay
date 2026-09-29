import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BridgeService } from './bridge.service';
import { BridgeController } from './bridge.controller';
import {
  BridgeTransaction,
  BridgeTransactionSchema,
} from './schemas/bridge-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BridgeTransaction.name, schema: BridgeTransactionSchema },
    ]),
  ],
  controllers: [BridgeController],
  providers: [BridgeService],
  exports: [BridgeService],
})
export class BridgeModule {}
