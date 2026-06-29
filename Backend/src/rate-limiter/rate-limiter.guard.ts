import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import {
  RateLimitTier,
  RATE_LIMIT_TIER_KEY,
  RATE_LIMIT_TIERS,
  TierConfig,
} from './rate-limiter.config';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string } }>();
    const res = http.getResponse<Response>();

    const tier = this.resolveTier(context);
    const config = RATE_LIMIT_TIERS[tier];
    const key = this.buildKey(req, tier);

    const result = this.rateLimiterService.check(key, config.limit, config.windowMs);

    this.setHeaders(res, result.limit, result.remaining, result.resetAt);

    if (!result.allowed) {
      this.logger.warn(
        `Rate limit exceeded — key=${key} tier=${tier} retryAfter=${result.retryAfterMs}ms`,
      );

      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: config.message,
          retryAfterMs: result.retryAfterMs,
          resetAt: new Date(result.resetAt).toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveTier(context: ExecutionContext): RateLimitTier {
    return (
      this.reflector.getAllAndOverride<RateLimitTier>(RATE_LIMIT_TIER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'standard'
    );
  }

  private buildKey(
    req: Request & { user?: { id?: string } },
    tier: RateLimitTier,
  ): string {
    const identity = req.user?.id ?? this.extractIp(req);
    const route = `${req.method}:${req.route?.path ?? req.path}`;
    return `rl:${tier}:${identity}:${route}`;
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }

  private setHeaders(
    res: Response,
    limit: number,
    remaining: number,
    resetAt: number,
  ): void {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(remaining, 0));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
    res.setHeader(
      'X-RateLimit-Reset-Human',
      new Date(resetAt).toISOString(),
    );
  }
}
