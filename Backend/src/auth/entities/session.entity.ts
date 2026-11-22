export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}
