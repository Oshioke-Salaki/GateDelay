import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventNotificationService } from './event-notification.service';
import { CreateEventFilterDto, GetNotificationsDto } from './dto/event-notification.dto';
import { BlockchainEventType } from './event-notification.entity';

@Controller('event-notifications')
export class EventNotificationController {
  constructor(private readonly service: EventNotificationService) {}

  // ── Filters ────────────────────────────────────────────────────────────────

  @Post('filters')
  @HttpCode(HttpStatus.CREATED)
  createFilter(@Body() dto: CreateEventFilterDto) {
    return this.service.createFilter(dto);
  }

  @Get('filters')
  getFilters(@Query('userId') userId: string) {
    return this.service.getFiltersForUser(userId);
  }

  @Delete('filters/:filterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFilter(
    @Param('filterId') filterId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.removeFilter(filterId, userId);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  @Get()
  getNotifications(@Query() dto: GetNotificationsDto) {
    return this.service.getNotificationsForUser(dto.userId, dto.status);
  }

  @Post(':notificationId/delivered')
  markDelivered(@Param('notificationId') notificationId: string) {
    return this.service.markDelivered(notificationId);
  }

  // ── Manual event injection ─────────────────────────────────────────────────

  @Post('process')
  processEvent(
    @Body()
    body: {
      eventType: BlockchainEventType;
      contractAddress: string;
      txHash: string;
      blockNumber: number;
      payload: Record<string, unknown>;
    },
  ) {
    return this.service.processManualEvent(
      body.eventType,
      body.contractAddress,
      body.txHash,
      body.blockNumber,
      body.payload,
    );
  }
}
