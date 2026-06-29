import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimiterGuard } from './rate-limiter.guard';

@Global()
@Module({
  providers: [
    RateLimiterService,
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
  exports: [RateLimiterService],
})
export class RateLimiterModule {}
