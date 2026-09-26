import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheRefreshService } from './cache-refresh.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cache')
@UseGuards(JwtAuthGuard)
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheRefresh: CacheRefreshService,
  ) {}

  @Get('metrics')
  getMetrics() {
    return this.cacheService.getMetrics();
  }

  @Get('refresh-policy')
  getRefreshPolicy() {
    return this.cacheRefresh.describe();
  }

  @Delete('key/:key')
  async invalidateKey(@Param('key') key: string) {
    await this.cacheService.del(key);
    return { invalidated: key };
  }

  @Delete('pattern/:pattern')
  async invalidatePattern(@Param('pattern') pattern: string) {
    await this.cacheService.invalidatePattern(pattern);
    return { invalidated: pattern };
  }
}
