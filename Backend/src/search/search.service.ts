import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MarketDataService } from '../market-data/market-data.service';
import { SearchQueryDto } from './dto/search.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly marketDataService: MarketDataService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async search(dto: SearchQueryDto) {
    const cacheKey = `search:${JSON.stringify(dto)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const raw = await this.marketDataService.getFlights({
      flightStatus: dto.status,
      airline: dto.airline,
      flightNumber: dto.q,
      limit: 100,
    });

    let results: any[] = raw?.data ?? [];

    if (dto.q) {
      const q = dto.q.toLowerCase();
      results = results.filter(
        (f: any) =>
          f.flight?.iata?.toLowerCase().includes(q) ||
          f.airline?.name?.toLowerCase().includes(q) ||
          f.departure?.iata?.toLowerCase().includes(q) ||
          f.arrival?.iata?.toLowerCase().includes(q),
      );
    }

    if (dto.sortBy === 'date') {
      results.sort(
        (a: any, b: any) =>
          new Date(b.departure?.scheduled ?? 0).getTime() -
          new Date(a.departure?.scheduled ?? 0).getTime(),
      );
    }

    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;
    const paginated = results.slice(offset, offset + limit);
    const result = { total: results.length, offset, limit, data: paginated };

    await this.cache.set(cacheKey, result, 120_000);
    return result;
  }

  async getSuggestions(q: string) {
    const cacheKey = `suggestions:${q}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const raw = await this.marketDataService.getFlights({
      flightNumber: q,
      limit: 5,
    });
    const suggestions = (raw?.data ?? []).map((f: any) => ({
      flight: f.flight?.iata,
      airline: f.airline?.name,
      departure: f.departure?.iata,
      arrival: f.arrival?.iata,
    }));

    await this.cache.set(cacheKey, suggestions, 300_000);
    return suggestions;
  }
}
