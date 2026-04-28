import { IsString, IsEnum, IsOptional, IsObject, IsBoolean, IsArray } from 'class-validator';
import { NotificationChannel, NotificationType } from '../notification.entity';

export class SendNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(['trade_confirmation', 'market_update', 'price_alert', 'system', 'weekly_digest'])
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
