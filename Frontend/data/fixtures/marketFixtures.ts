/**
 * @file marketFixtures.ts
 *
 * Typed UI fixtures for development and testing.
 *
 * IMPORTANT — these are static, fabricated records used to let the UI render
 * without a live backend or chain. They must never be used on production
 * screens as a fallback for missing API data. Import this file only in:
 *   • Test files (*.test.ts / *.spec.ts)
 *   • Explicit demo/sandbox pages (e.g. /arbitrage-demo, /trade/[id] demo catalog)
 *   • Storybook stories
 *
 * Production pages that need real data should throw or show an empty state
 * when the API is unavailable, not silently substitute these records.
 */

// ─── Guard ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  // Surface a clear error rather than leaking fake data into prod bundles.
  throw new Error(
    "[marketFixtures] This module must not be imported in production builds. " +
      "Replace the import with a real API call or data-fetching hook.",
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────────

/** Minimal shape used by the home-page market list. */
export interface HomeMarketFixture {
  id: string;
  title: string;
  yesPrice: number;
  volume: number;
  status: string;
}

/** Full shape used by MarketCard / DashboardPage. */
export interface DashboardMarketFixture {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed" | "resolved" | "disputed";
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  image?: string;
}

/** Shape used by the market-detail page (markets/[id]). */
export interface MarketDetailFixture {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed" | "resolved" | "disputed";
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  participants: number;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  recentTrades: Array<{
    side: string;
    amount: number;
    price: number;
    time: string;
  }>;
}

/** Shape used by TradingInterface / trade/[id]. */
export interface TradingMarketFixture {
  id: string;
  name: string;
  description: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  totalLiquidity: number;
  expiryDate: string;
  status: "active" | "paused" | "settled";
}

/** Shape used by the arbitrage demo and ArbitrageDisplay component. */
export interface ArbitrageMarketFixture {
  id: string;
  name: string;
  asset: string;
  price: number;
  feePercent: number;
  liquidity: number;
  tokenAddress: string;
  routerAddress: string;
}

/** Shape used by SimulationMode's market picker. */
export interface SimulationMarketFixture {
  id: string;
  title: string;
  yesPrice: number;
  noPrice: number;
}

// ─── Home page market list ────────────────────────────────────────────────────

export const HOME_MARKET_FIXTURES: HomeMarketFixture[] = [
  { id: "1", title: "Will AA123 arrive on time?", yesPrice: 0.62, volume: 14820, status: "open" },
  { id: "2", title: "Will UA456 be delayed > 30 min?", yesPrice: 0.41, volume: 8300, status: "open" },
  { id: "3", title: "Will DL789 be cancelled?", yesPrice: 0.08, volume: 3200, status: "open" },
];

// ─── Dashboard / MarketCard grid ──────────────────────────────────────────────

export const DASHBOARD_MARKET_FIXTURES: DashboardMarketFixture[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines AA123 from JFK to LAX on Apr 25, 2026.",
    status: "open",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 14820,
    liquidity: 5400,
  },
  {
    id: "2",
    title: "Will UA456 be delayed > 30 min?",
    description: "United Airlines UA456 from ORD to SFO on Apr 26, 2026.",
    status: "open",
    yesPrice: 0.41,
    noPrice: 0.59,
    volume: 8300,
    liquidity: 3100,
  },
  {
    id: "3",
    title: "Will DL789 be cancelled?",
    description: "Delta Airlines DL789 from ATL to BOS on Apr 27, 2026.",
    status: "closed",
    yesPrice: 0.08,
    noPrice: 0.92,
    volume: 3200,
    liquidity: 1200,
  },
  {
    id: "4",
    title: "Will SW101 depart on time?",
    description: "Southwest SW101 from DAL to DEN on Apr 28, 2026.",
    status: "open",
    yesPrice: 0.75,
    noPrice: 0.25,
    volume: 6700,
    liquidity: 2800,
  },
  {
    id: "5",
    title: "Will BA202 arrive early?",
    description: "British Airways BA202 from LHR to JFK on Apr 29, 2026.",
    status: "resolved",
    yesPrice: 0.55,
    noPrice: 0.45,
    volume: 21000,
    liquidity: 9000,
  },
  {
    id: "6",
    title: "Will EK505 be diverted?",
    description: "Emirates EK505 from DXB to LAX on Apr 30, 2026.",
    status: "open",
    yesPrice: 0.12,
    noPrice: 0.88,
    volume: 4500,
    liquidity: 1800,
  },
];

// ─── Market detail page ───────────────────────────────────────────────────────

export const MARKET_DETAIL_FIXTURE: MarketDetailFixture = {
  id: "1",
  title: "Will AA123 arrive on time?",
  description: "American Airlines flight AA123 from JFK to LAX on Apr 25, 2026.",
  status: "open",
  yesPrice: 0.62,
  noPrice: 0.38,
  volume: 14820,
  liquidity: 5400,
  participants: 87,
  resolvedAt: undefined,
  outcome: undefined,
  recentTrades: [
    { side: "YES", amount: 50, price: 0.62, time: "2m ago" },
    { side: "NO", amount: 120, price: 0.38, time: "5m ago" },
    { side: "YES", amount: 200, price: 0.61, time: "11m ago" },
    { side: "NO", amount: 75, price: 0.39, time: "18m ago" },
    { side: "YES", amount: 300, price: 0.60, time: "25m ago" },
  ],
};

// ─── Trading interface demo catalog (trade/[id]) ──────────────────────────────

export const TRADING_MARKET_FIXTURES: Record<string, TradingMarketFixture> = {
  "market-1": {
    id: "market-1",
    name: "AA 1234 - JFK to LAX",
    description:
      "Will American Airlines flight 1234 from JFK to LAX be delayed by more than 30 minutes on Dec 25, 2026?",
    currentPrice: 1.0025,
    priceChange24h: 2.45,
    volume24h: 125000,
    high24h: 1.015,
    low24h: 0.985,
    totalLiquidity: 500000,
    expiryDate: "2026-12-25T23:59:59Z",
    status: "active",
  },
  "market-2": {
    id: "market-2",
    name: "UA 5678 - SFO to ORD",
    description:
      "Will United Airlines flight 5678 from SFO to ORD be cancelled on Dec 26, 2026?",
    currentPrice: 0.35,
    priceChange24h: -1.25,
    volume24h: 85000,
    high24h: 0.375,
    low24h: 0.32,
    totalLiquidity: 350000,
    expiryDate: "2026-12-26T23:59:59Z",
    status: "active",
  },
  "market-3": {
    id: "market-3",
    name: "DL 9012 - ATL to MIA",
    description:
      "Will Delta flight 9012 from ATL to MIA depart on time on Dec 27, 2026?",
    currentPrice: 0.75,
    priceChange24h: 0.85,
    volume24h: 95000,
    high24h: 0.78,
    low24h: 0.72,
    totalLiquidity: 420000,
    expiryDate: "2026-12-27T23:59:59Z",
    status: "active",
  },
};

export const TRADING_MARKET_FIXTURE_IDS = Object.keys(TRADING_MARKET_FIXTURES);

// ─── Arbitrage demo ───────────────────────────────────────────────────────────

export const ARBITRAGE_MARKET_FIXTURES: ArbitrageMarketFixture[] = [
  {
    id: "m1",
    name: "Binance ETH-USDT",
    asset: "ETH",
    price: 2000,
    feePercent: 0.1,
    liquidity: 500,
    // placeholder ERC20 token addresses for demo; replace with local mock tokens when testing locally
    tokenAddress: "0x1000000000000000000000000000000000000001",
    routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  {
    id: "m2",
    name: "Uniswap ETH-USDT",
    asset: "ETH",
    // Priced ~5% above Binance so the demo surfaces at least one profitable
    // opportunity on first load (spread must beat the 0.1% + 0.3% fees).
    price: 2100,
    feePercent: 0.3,
    liquidity: 300,
    tokenAddress: "0x1000000000000000000000000000000000000001",
    routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  {
    id: "m3",
    name: "Kraken BTC-USDT",
    asset: "BTC",
    price: 30000,
    feePercent: 0.2,
    liquidity: 50,
    tokenAddress: "0x2000000000000000000000000000000000000002",
    routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  {
    id: "m4",
    name: "Binance BTC-USDT",
    asset: "BTC",
    price: 29950,
    feePercent: 0.1,
    liquidity: 200,
    tokenAddress: "0x2000000000000000000000000000000000000002",
    routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
];

// ─── Simulation mode market picker ───────────────────────────────────────────

export const SIMULATION_MARKET_FIXTURES: SimulationMarketFixture[] = [
  { id: "1", title: "Will BTC exceed $100k by EOY?", yesPrice: 0.65, noPrice: 0.35 },
  { id: "2", title: "Will ETH outperform BTC?", yesPrice: 0.55, noPrice: 0.45 },
  { id: "3", title: "Will SOL reach $500?", yesPrice: 0.4, noPrice: 0.6 },
];

/** Convenience lookup for SimulationMode's select handler. */
export const SIMULATION_MARKET_FIXTURE_MAP: Record<string, SimulationMarketFixture> =
  Object.fromEntries(SIMULATION_MARKET_FIXTURES.map((m) => [m.id, m]));
