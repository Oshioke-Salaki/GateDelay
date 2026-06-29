export type ApiKeyStatus = 'active' | 'revoked';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  permissions: string[];
  rateLimitPerMinute: number;
  status: ApiKeyStatus;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  rotatedAt?: Date;
  rotatedToKeyId?: string;
}

export interface ApiKeyUsageEvent {
  keyId: string;
  endpoint: string;
  scope?: string;
  allowed: boolean;
  reason?: string;
  timestamp: Date;
}

export interface ApiKeyAnalytics {
  keyId: string;
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  lastUsedAt?: Date;
  byEndpoint: Record<string, number>;
  byScope: Record<string, number>;
  recentEvents: ApiKeyUsageEvent[];
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyId?: string;
  reason?: string;
  remaining?: number;
}
