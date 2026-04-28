import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CacheService } from './cache.service';

const CACHEABLE_PATHS = ['/api/market-data'];
const DEFAULT_TTL = 30_000; // 30s

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CacheMiddleware.name);

  constructor(private readonly cacheService: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const isCacheable =
      req.method === 'GET' &&
      CACHEABLE_PATHS.some((p) => req.path.startsWith(p));

    if (!isCacheable) return next();

    const key = `http:${req.path}:${JSON.stringify(req.query)}`;
    const cached = await this.cacheService.get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        this.cacheService.set(key, body, DEFAULT_TTL).catch((err) =>
          this.logger.warn(`Failed to cache response: ${err}`),
        );
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  }
}
