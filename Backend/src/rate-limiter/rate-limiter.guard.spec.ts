import { Reflector } from '@nestjs/core';
import { RateLimiterGuard } from './rate-limiter.guard';
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterGuard', () => {
  it('uses the socket/request IP instead of a client-supplied forwarding header', () => {
    const guard = new RateLimiterGuard(
      new Reflector(),
      new RateLimiterService(),
    );
    const request = {
      ip: '10.0.0.7',
      socket: { remoteAddress: '10.0.0.7' },
      headers: { 'x-forwarded-for': '198.51.100.10' },
      method: 'GET',
      path: '/api/market-audit/logs',
    } as never;

    const key = (
      guard as unknown as {
        buildKey: (request: unknown, tier: string) => string;
      }
    ).buildKey(request, 'admin');

    expect(key).toContain('10.0.0.7');
    expect(key).not.toContain('198.51.100.10');
  });
});
