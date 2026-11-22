import { resolveApiBase } from './apiBase';

export type MarketStatus = 'open' | 'closed' | 'resolved' | 'pending' | string;

export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  status: MarketStatus;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  participants: number;
  createdAt: string;
  resolvedAt: string | null;
  outcome: string | null;
}

export interface MarketSearchFilters {
  query?: string;
  category?: string;
  status?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface MarketSearchResult {
  markets: Market[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FetchMarketsByIdsResult {
  found: Market[];
  missing: string[];
}

export class MarketNotFoundError extends Error {
  readonly marketId: string;

  constructor(marketId: string) {
    super(`Market not found: ${marketId}`);
    this.name = 'MarketNotFoundError';
    this.marketId = marketId;
  }
}

export class MarketApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'MarketApiError';
    this.status = status;
    this.url = url;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = resolveApiBase().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MarketApiError(`Network request failed for ${url}: ${reason}`, 0, url);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      if (body) {
        detail = `: ${body.slice(0, 200)}`;
      }
    } catch {
      // Ignore body read failures; the status is enough to describe the error.
    }
    throw new MarketApiError(
      `Request to ${url} failed with status ${response.status} ${response.statusText}${detail}`,
      response.status,
      url,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MarketApiError(`Failed to parse JSON response from ${url}: ${reason}`, response.status, url);
  }
}

function normalizeMarket(raw: any): Market {
  return {
    id: String(raw?.id ?? raw?.marketId ?? ''),
    title: String(raw?.title ?? raw?.question ?? raw?.name ?? ''),
    description: String(raw?.description ?? ''),
    category: String(raw?.category ?? ''),
    status: String(raw?.status ?? ''),
    yesPrice: Number(raw?.yesPrice ?? raw?.yes_price ?? 0),
    noPrice: Number(raw?.noPrice ?? raw?.no_price ?? 0),
    volume: Number(raw?.volume ?? 0),
    liquidity: Number(raw?.liquidity ?? 0),
    participants: Number(raw?.participants ?? raw?.participantCount ?? 0),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
    resolvedAt: raw?.resolvedAt ?? raw?.resolved_at ?? null,
    outcome: raw?.outcome ?? null,
  };
}

export async function fetchMarketById(id: string): Promise<Market> {
  const url = buildUrl(`/markets/${encodeURIComponent(id)}`);

  try {
    const data = await request<any>(url);
    const payload = data?.market ?? data?.data ?? data;
    return normalizeMarket(payload);
  } catch (error) {
    if (error instanceof MarketApiError && error.status === 404) {
      throw new MarketNotFoundError(id);
    }
    throw error;
  }
}

export async function searchMarkets(filters: MarketSearchFilters = {}): Promise<MarketSearchResult> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

  const url = buildUrl('/markets/search', {
    query: filters.query,
    q: filters.query,
    category: filters.category,
    status: filters.status,
    sortBy: filters.sortBy,
    page,
    pageSize,
  });

  const data = await request<any>(url);
  const rawMarkets: any[] = Array.isArray(data?.markets)
    ? data.markets
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];

  const total = Number(data?.total ?? rawMarkets.length);
  const resolvedPageSize = Number(data?.pageSize ?? data?.limit ?? pageSize);
  const resolvedPage = Number(data?.page ?? page);
  const totalPages = Number(
    data?.totalPages ??
      data?.total_pages ??
      (resolvedPageSize > 0 ? Math.max(1, Math.ceil(total / resolvedPageSize)) : 1),
  );

  return {
    markets: rawMarkets.map(normalizeMarket),
    page: resolvedPage,
    pageSize: resolvedPageSize,
    total,
    totalPages,
  };
}

export async function fetchMarketsByIds(ids: string[]): Promise<FetchMarketsByIdsResult> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));

  if (uniqueIds.length === 0) {
    return { found: [], missing: [] };
  }

  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const market = await fetchMarketById(id);
        return { id, market };
      } catch (error) {
        if (error instanceof MarketNotFoundError) {
          return { id, market: null };
        }
        throw error;
      }
    }),
  );

  const found: Market[] = [];
  const missing: string[] = [];

  results.forEach(({ id, market }) => {
    if (market) {
      found.push(market);
    } else {
      missing.push(id);
    }
  });

  return { found, missing };
}