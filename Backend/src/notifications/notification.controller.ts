import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto, UpdatePreferencesDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get()
  getMyNotifications(@Request() req: any) {
    return this.notificationService.getForUser(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationService.markRead(req.user.id, id);
  }

  @Get('preferences')
  getPreferences(@Request() req: any) {
    return this.notificationService.getPrefs(req.user.id);
  }

  @Patch('preferences')
  updatePreferences(@Request() req: any, @Body() dto: UpdatePreferencesDto) {
    return this.notificationService.updatePrefs(req.user.id, dto);
  }

  @Get('metrics')
  getMetrics(@Request() req: any) {
    return this.notificationService.getMetrics(req.user.id);
  }
}
