import { Module } from '@nestjs/common';
import { EventNotificationService } from './event-notification.service';
import { EventNotificationController } from './event-notification.controller';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [EventNotificationController],
  providers: [EventNotificationService],
  exports: [EventNotificationService],
})
export class EventNotificationModule {}
