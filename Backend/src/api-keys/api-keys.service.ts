import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ApiKeyAnalytics,
  ApiKeyRecord,
  ApiKeyUsageEvent,
  ApiKeyValidationResult,
} from './api-keys.entity';
import {
  CreateApiKeyDto,
  RotateApiKeyDto,
  ValidateApiKeyDto,
} from './dto/api-keys.dto';

@Injectable()
export class ApiKeysService {
  private readonly apiKeys = new Map<string, ApiKeyRecord>();
  private readonly keyHashToId = new Map<string, string>();
  private readonly keysByUser = new Map<string, Set<string>>();
  private readonly usageByKey = new Map<string, ApiKeyUsageEvent[]>();
  private readonly requestWindowByKey = new Map<string, number[]>();

  createKey(userId: string, dto: CreateApiKeyDto) {
    const keyMaterial = crypto.randomBytes(32).toString('hex');
    const apiKey = `gdk_${keyMaterial}`;
    const keyHash = this.hashKey(apiKey);

    if (this.keyHashToId.has(keyHash)) {
      throw new BadRequestException('Generated API key collision. Retry request.');
    }

    const record: ApiKeyRecord = {
      id: crypto.randomUUID(),
      userId,
      name: dto.name,
      keyPrefix: apiKey.slice(0, 10),
      keyHash,
      scopes: this.normalizeStringArray(dto.scopes, ['read']),
      permissions: this.normalizeStringArray(dto.permissions, ['read']),
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
      status: 'active',
      createdAt: new Date(),
    };

    this.apiKeys.set(record.id, record);
    this.keyHashToId.set(keyHash, record.id);

    if (!this.keysByUser.has(userId)) {
      this.keysByUser.set(userId, new Set());
    }
    this.keysByUser.get(userId)?.add(record.id);

    return {
      apiKey,
      key: this.publicRecord(record),
    };
  }

  listKeys(userId: string, status?: 'active' | 'revoked') {
    const ids = this.keysByUser.get(userId) ?? new Set<string>();
    const keys = [...ids]
      .map((id) => this.apiKeys.get(id))
      .filter(Boolean)
      .filter((item) => !status || item?.status === status)
      .map((item) => this.publicRecord(item as ApiKeyRecord));

    return keys.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  revokeKey(userId: string, keyId: string, reason?: string) {
    const key = this.getOwnedKeyOrThrow(userId, keyId);

    if (key.status === 'revoked') {
      return this.publicRecord(key);
    }

    key.status = 'revoked';
    key.revokedAt = new Date();
    key.revokedReason = reason;

    this.apiKeys.set(keyId, key);
    return this.publicRecord(key);
  }

  rotateKey(userId: string, keyId: string, dto: RotateApiKeyDto) {
    const current = this.getOwnedKeyOrThrow(userId, keyId);

    if (current.status !== 'active') {
      throw new BadRequestException('Only active API keys can be rotated');
    }

    const next = this.createKey(userId, {
      name: dto.newName ?? `${current.name} (rotated)`,
      scopes: dto.scopes ?? current.scopes,
      permissions: dto.permissions ?? current.permissions,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? current.rateLimitPerMinute,
    });

    current.status = 'revoked';
    current.revokedAt = new Date();
    current.revokedReason = 'Rotated';
    current.rotatedAt = new Date();
    current.rotatedToKeyId = next.key.id;

    this.apiKeys.set(current.id, current);

    return {
      apiKey: next.apiKey,
      key: next.key,
      replacedKey: this.publicRecord(current),
    };
  }

  validate(dto: ValidateApiKeyDto): ApiKeyValidationResult {
    const hash = this.hashKey(dto.apiKey);
    const keyId = this.keyHashToId.get(hash);

    if (!keyId) {
      return { valid: false, reason: 'Unknown API key' };
    }

    const key = this.apiKeys.get(keyId);
    if (!key || key.status !== 'active') {
      this.recordUsage(
        keyId,
        dto.endpoint ?? 'unknown',
        undefined,
        false,
        'Revoked key',
      );
      return { valid: false, keyId, reason: 'API key is revoked' };
    }

    const scopeResult = this.ensureScopes(key, dto.requiredScopes ?? []);
    if (!scopeResult.ok) {
      this.recordUsage(
        key.id,
        dto.endpoint ?? 'unknown',
        scopeResult.failedScope,
        false,
        'Missing scope',
      );
      return {
        valid: false,
        keyId: key.id,
        reason: `Missing required scope: ${scopeResult.failedScope}`,
      };
    }

    const rateResult = this.checkRateLimit(key);
    if (!rateResult.allowed) {
      this.recordUsage(
        key.id,
        dto.endpoint ?? 'unknown',
        dto.requiredScopes?.[0],
        false,
        'Rate limit exceeded',
      );
      return {
        valid: false,
        keyId: key.id,
        reason: 'Rate limit exceeded',
        remaining: 0,
      };
    }

    key.lastUsedAt = new Date();
    this.apiKeys.set(key.id, key);

    this.recordUsage(
      key.id,
      dto.endpoint ?? 'unknown',
      dto.requiredScopes?.[0],
      true,
    );

    return {
      valid: true,
      keyId: key.id,
      remaining: rateResult.remaining,
    };
  }

  getUsageAnalytics(userId: string, keyId: string): ApiKeyAnalytics {
    const key = this.getOwnedKeyOrThrow(userId, keyId);
    const events = this.usageByKey.get(key.id) ?? [];

    const byEndpoint: Record<string, number> = {};
    const byScope: Record<string, number> = {};

    for (const event of events) {
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] ?? 0) + 1;
      if (event.scope) {
        byScope[event.scope] = (byScope[event.scope] ?? 0) + 1;
      }
    }

    return {
      keyId: key.id,
      totalRequests: events.length,
      allowedRequests: events.filter((event) => event.allowed).length,
      deniedRequests: events.filter((event) => !event.allowed).length,
      lastUsedAt: key.lastUsedAt,
      byEndpoint,
      byScope,
      recentEvents: events.slice(-20).reverse(),
    };
  }

  private getOwnedKeyOrThrow(userId: string, keyId: string): ApiKeyRecord {
    const key = this.apiKeys.get(keyId);

    if (!key || key.userId !== userId) {
      throw new NotFoundException('API key not found');
    }

    return key;
  }

  private ensureScopes(
    key: ApiKeyRecord,
    requiredScopes: string[],
  ): { ok: true } | { ok: false; failedScope: string } {
    for (const requiredScope of requiredScopes) {
      if (!key.scopes.includes(requiredScope)) {
        return { ok: false, failedScope: requiredScope };
      }
    }

    return { ok: true };
  }

  private checkRateLimit(
    key: ApiKeyRecord,
  ): { allowed: true; remaining: number } | { allowed: false } {
    const now = Date.now();
    const minWindowMs = 60_000;
    const currentWindow = (this.requestWindowByKey.get(key.id) ?? []).filter(
      (value) => value > now - minWindowMs,
    );

    if (currentWindow.length >= key.rateLimitPerMinute) {
      this.requestWindowByKey.set(key.id, currentWindow);
      return { allowed: false };
    }

    currentWindow.push(now);
    this.requestWindowByKey.set(key.id, currentWindow);

    return {
      allowed: true,
      remaining: key.rateLimitPerMinute - currentWindow.length,
    };
  }

  private recordUsage(
    keyId: string,
    endpoint: string,
    scope: string | undefined,
    allowed: boolean,
    reason?: string,
  ): void {
    const current = this.usageByKey.get(keyId) ?? [];

    current.push({
      keyId,
      endpoint,
      scope,
      allowed,
      reason,
      timestamp: new Date(),
    });

    if (current.length > 1000) {
      current.splice(0, current.length - 1000);
    }

    this.usageByKey.set(keyId, current);
  }

  private hashKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private normalizeStringArray(
    source: string[] | undefined,
    fallback: string[],
  ): string[] {
    const chosen = source && source.length > 0 ? source : fallback;

    const normalized = chosen
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (normalized.length === 0) {
      throw new BadRequestException('At least one scope or permission is required');
    }

    return [...new Set(normalized)];
  }

  private publicRecord(key: ApiKeyRecord) {
    const { keyHash, ...rest } = key;
    void keyHash;
    return rest;
  }

  assertCanAccess(apiKey: string, requiredScopes: string[], endpoint: string) {
    const validation = this.validate({
      apiKey,
      requiredScopes,
      endpoint,
    });

    if (!validation.valid) {
      throw new UnauthorizedException(validation.reason ?? 'Invalid API key');
    }

    return validation;
  }
}
