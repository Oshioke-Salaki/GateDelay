import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { CacheMiddleware } from './cache.middleware';

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
