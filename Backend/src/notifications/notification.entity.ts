export type NotificationChannel = 'email' | 'push' | 'in-app';
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'read';
export type NotificationType =
  | 'trade_confirmation'
  | 'market_update'
  | 'price_alert'
  | 'system'
  | 'weekly_digest';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  error?: string;
}

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  optedOutTypes: NotificationType[];
  fcmToken?: string;
}
