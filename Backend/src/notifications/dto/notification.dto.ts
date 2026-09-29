import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  NotificationChannel,
  NotificationType,
} from '../notification.entity';

/** Upper bound on a single notification page. */
export const MAX_NOTIFICATIONS_PAGE_SIZE = 100;

/**
 * Query DTO for a user's notification inbox (#916).
 *
 * Notifications are the fastest-growing list a user has, and returning the whole
 * history means a user with a few thousand entries pulls all of them on every
 * page load.
 */
export class GetNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATIONS_PAGE_SIZE)
  limit?: number;
}

export class SendNotificationDto {
  @IsString()
  userId: string;

  @IsEnum([
    'trade_confirmation',
    'market_update',
    'price_alert',
    'system',
    'weekly_digest',
    'trade_filled',
    'dispute_opened',
    'market_resolved',
  ])
  type: NotificationType;

  @IsEnum(['email', 'push', 'in-app'])
  @IsOptional()
  channel?: NotificationChannel;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @IsBoolean()
  @IsOptional()
  push?: boolean;

  @IsBoolean()
  @IsOptional()
  inApp?: boolean;

  @IsArray()
  @IsOptional()
  optedOutTypes?: NotificationType[];

  @IsString()
  @IsOptional()
  fcmToken?: string;
}
