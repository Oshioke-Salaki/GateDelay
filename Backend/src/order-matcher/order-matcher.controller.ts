import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OrderMatcherService } from './order-matcher.service';
import { PlaceOrderDto, CancelOrderDto } from './order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderMatcherController {
  constructor(private readonly orderMatcher: OrderMatcherService) {}

  @Post()
  place(@Request() req: { user: { id: string } }, @Body() dto: PlaceOrderDto) {
    return this.orderMatcher.placeOrder(req.user.id, dto);
  }

  @Delete('cancel')
  cancel(
    @Request() req: { user: { id: string } },
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderMatcher.cancelOrder(req.user.id, dto.orderId);
  }

  @Get('book')
  book(
    @Query('venueId') venueId: string,
    @Query('pair') pair: string,
  ) {
    return this.orderMatcher.getOrderBook(venueId, pair);
  }

  @Get('mine')
  mine(@Request() req: { user: { id: string } }) {
    return this.orderMatcher.getUserOrders(req.user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.orderMatcher.getOrder(id);
  }

  @Get(':id/fills')
  fills(@Param('id') id: string) {
    return this.orderMatcher.getFills(id);
  }
}
