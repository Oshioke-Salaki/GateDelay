import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '../cache/cache.service';

const TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'http://api.aviationstack.com/v1';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.apiKey = this.configService.get<string>('AVIATION_STACK_API_KEY', '');
  }

  async getFlights(params: {
    flightStatus?: string;
    airline?: string;
    flightNumber?: string;
    limit?: number;
    offset?: number;
  }) {
    const key = `flights:${JSON.stringify(params)}`;
    return this.cache.getOrSet(key, () =>
      this.fetch('/flights', {
        flight_status: params.flightStatus,
        airline_name: params.airline,
        flight_iata: params.flightNumber,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      }), TTL);
  }

  async getFlightByIata(iata: string) {
    return this.cache.getOrSet(`flight:${iata}`, () =>
      this.fetch('/flights', { flight_iata: iata, limit: 1 }), TTL);
  }

  async getAirlines(params: { search?: string; limit?: number }) {
    const key = `airlines:${JSON.stringify(params)}`;
    return this.cache.getOrSet(key, () =>
      this.fetch('/airlines', { search: params.search, limit: params.limit ?? 20 }), TTL);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async warmPopularData() {
    this.logger.log('Warming popular market data cache...');
    await this.cache.warm([
      {
        key: 'flights:active',
        factory: () => this.fetch('/flights', { flight_status: 'active', limit: 100 }),
        ttlMs: TTL,
      },
      {
        key: 'airlines:top',
        factory: () => this.fetch('/airlines', { limit: 50 }),
        ttlMs: TTL,
      },
    ]);
  }

  private async fetch(endpoint: string, params: Record<string, unknown>) {
    const clean = Object.fromEntries(
      Object.entries({ ...params, access_key: this.apiKey }).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      ),
    );
    const res = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}${endpoint}`, {
        params: clean,
        timeout: 10000,
      }),
    );
    return res.data;
  }
}
