import { Module } from '@nestjs/common';
import { OrderMatcherService } from './order-matcher.service';
import { OrderMatcherController } from './order-matcher.controller';

@Module({
  controllers: [OrderMatcherController],
  providers: [OrderMatcherService],
  exports: [OrderMatcherService],
})
export class OrderMatcherModule {}
