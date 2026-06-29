import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TradeEngineService } from './trade-engine.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { OrderStatus } from './schemas/order.schema';

@UseGuards(JwtAuthGuard)
@Controller('trade-engine')
export class TradeEngineController {
  constructor(private readonly tradeEngineService: TradeEngineService) {}

  /** POST /trade-engine/orders — place a new order */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  placeOrder(@Request() req: { user: { id: string } }, @Body() dto: PlaceOrderDto) {
    return this.tradeEngineService.placeOrder(req.user.id, dto);
  }

  /** DELETE /trade-engine/orders/:id — cancel an open order */
  @Delete('orders/:id')
  cancelOrder(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.tradeEngineService.cancelOrder(req.user.id, id);
  }

  /** GET /trade-engine/orders/:id — retrieve a single order */
  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.tradeEngineService.getOrder(id);
  }

  /** GET /trade-engine/orders — list caller's orders (optional status filter) */
  @Get('orders')
  getUserOrders(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
  ) {
    return this.tradeEngineService.getUserOrders(req.user.id, status as OrderStatus);
  }

  /** GET /trade-engine/order-book/:pair — live order book for a pair */
  @Get('order-book/:pair')
  getOrderBook(@Param('pair') pair: string) {
    return this.tradeEngineService.getOrderBook(pair);
  }
}
