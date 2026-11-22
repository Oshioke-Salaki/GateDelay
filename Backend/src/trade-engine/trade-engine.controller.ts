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

  /**
   * POST /trade-engine/orders — place a new order
   *
   * Requires a configured CLOB venue and pair. An `Idempotency-Key` makes
   * retries safe; matching is off-chain and does not settle on-chain (#912).
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  placeOrder(
    @Request()
    req: { user: { id: string }; headers: Record<string, string | undefined> },
    @Body() dto: PlaceOrderDto,
  ) {
    return this.tradeEngineService.placeOrder(req.user.id, dto, {
      idempotencyKey: req.headers?.['idempotency-key'],
    });
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
    return this.tradeEngineService.getUserOrders(
      req.user.id,
      status as OrderStatus,
    );
  }

  /** GET /trade-engine/order-book/:pair — CLOB book scoped to a configured venue */
  @Get('order-book/:pair')
  getOrderBook(
    @Param('pair') pair: string,
    @Query('venueId') venueId: string,
  ) {
    return this.tradeEngineService.getOrderBook(venueId, pair);
  }
}
