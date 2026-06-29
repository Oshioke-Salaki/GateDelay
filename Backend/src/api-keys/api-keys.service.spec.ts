import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(() => {
    service = new ApiKeysService();
  });

  it('generates secure API keys and stores only hashed values', () => {
    const result = service.createKey('user-1', {
      name: 'server key',
      scopes: ['read', 'write'],
      permissions: ['transactions:read'],
      rateLimitPerMinute: 5,
    });

    expect(result.apiKey.startsWith('gdk_')).toBe(true);
    expect(result.apiKey.length).toBeGreaterThanOrEqual(68);
    expect((result.key as { keyHash?: string }).keyHash).toBeUndefined();
  });

  it('enforces scope permissions during validation', () => {
    const created = service.createKey('user-1', {
      name: 'limited key',
      scopes: ['read'],
      permissions: ['read'],
      rateLimitPerMinute: 10,
    });

    const allowed = service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['read'],
      endpoint: '/markets',
    });
    expect(allowed.valid).toBe(true);

    const denied = service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['write'],
      endpoint: '/orders',
    });
    expect(denied.valid).toBe(false);
    expect(denied.reason).toContain('Missing required scope');
  });

  it('tracks key usage analytics', () => {
    const created = service.createKey('user-1', {
      name: 'analytics key',
      scopes: ['read'],
      permissions: ['read'],
      rateLimitPerMinute: 10,
    });

    service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['read'],
      endpoint: '/a',
    });
    service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['read'],
      endpoint: '/a',
    });
    service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['write'],
      endpoint: '/b',
    });

    const analytics = service.getUsageAnalytics('user-1', created.key.id);
    expect(analytics.totalRequests).toBe(3);
    expect(analytics.allowedRequests).toBe(2);
    expect(analytics.deniedRequests).toBe(1);
    expect(analytics.byEndpoint['/a']).toBe(2);
    expect(analytics.byEndpoint['/b']).toBe(1);
  });

  it('supports revocation and rotation', () => {
    const created = service.createKey('user-1', {
      name: 'rotation key',
      scopes: ['read'],
      permissions: ['read'],
      rateLimitPerMinute: 10,
    });

    const revoked = service.revokeKey('user-1', created.key.id, 'manual revoke');
    expect(revoked.status).toBe('revoked');

    const revokedValidation = service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['read'],
      endpoint: '/status',
    });
    expect(revokedValidation.valid).toBe(false);

    const fresh = service.createKey('user-1', {
      name: 'to rotate',
      scopes: ['read'],
      permissions: ['read'],
      rateLimitPerMinute: 10,
    });

    const rotated = service.rotateKey('user-1', fresh.key.id, {
      newName: 'rotated name',
      scopes: ['read', 'write'],
    });

    const oldValidation = service.validate({
      apiKey: fresh.apiKey,
      requiredScopes: ['read'],
      endpoint: '/x',
    });
    expect(oldValidation.valid).toBe(false);

    const newValidation = service.validate({
      apiKey: rotated.apiKey,
      requiredScopes: ['write'],
      endpoint: '/x',
    });
    expect(newValidation.valid).toBe(true);
  });

  it('applies per-key rate limiting', () => {
    const created = service.createKey('user-1', {
      name: 'rate-limited key',
      scopes: ['read'],
      permissions: ['read'],
      rateLimitPerMinute: 2,
    });

    expect(
      service.validate({
        apiKey: created.apiKey,
        requiredScopes: ['read'],
        endpoint: '/r',
      }).valid,
    ).toBe(true);

    expect(
      service.validate({
        apiKey: created.apiKey,
        requiredScopes: ['read'],
        endpoint: '/r',
      }).valid,
    ).toBe(true);

    const denied = service.validate({
      apiKey: created.apiKey,
      requiredScopes: ['read'],
      endpoint: '/r',
    });

    expect(denied.valid).toBe(false);
    expect(denied.reason).toBe('Rate limit exceeded');
  });
});
