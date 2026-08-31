import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { CacheMiddleware } from './cache.middleware';

/**
 * Boot Dependencies for AppCacheModule
 * ======================================
 *
 * This module requires the following dependencies to be available at boot time:
 *
 * 1. Redis Server
 *    - CacheService uses Redis as L2 cache via @nestjs/cache-manager
 *    - Required environment variables:
 *      - REDIS_HOST (default: 'localhost')
 *      - REDIS_PORT (default: 6379)
 *    - Redis must be running and accessible before application starts
 *
 * 2. @nestjs/cache-manager (Global)
 *    - Configured globally in app.module.ts with Redis store
 *    - Uses @keyv/redis for Redis connection
 *    - CacheService injects CACHE_MANAGER token
 *
 * 3. @nestjs/config
 *    - Required for reading REDIS_HOST and REDIS_PORT environment variables
 *    - Configured globally in app.module.ts
 *
 * 4. AuthModule (for CacheController)
 *    - CacheController uses JwtAuthGuard from auth module
 *    - Must be imported before AppCacheModule in app.module.ts
 *
 * Architecture:
 * - L1: In-memory Map (500 entries, 30s TTL)
 * - L2: Redis (distributed cache)
 * - Middleware: Caches GET requests to /api/market-data*
 */
@Module({
  providers: [CacheService],
  controllers: [CacheController],
  exports: [CacheService],
})
export class AppCacheModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CacheMiddleware)
      .forRoutes({ path: 'market-data*', method: RequestMethod.GET });
  }
}
