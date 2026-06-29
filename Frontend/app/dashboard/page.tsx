"use client";
import Link from "next/link";
import DashboardLayout from "../../components/layout/DashboardLayout";
import MarketCard, { Market } from "../../components/market/MarketCard";
import TrendingMarkets from "../../components/dashboard/TrendingMarkets";

const SAMPLE_MARKETS: Market[] = [
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

const STATS = [
  { label: "Active Markets", value: SAMPLE_MARKETS.filter((m) => m.status === "open").length },
  { label: "Total Volume", value: `$${SAMPLE_MARKETS.reduce((s, m) => s + m.volume, 0).toLocaleString()}` },
  { label: "Total Liquidity", value: `$${SAMPLE_MARKETS.reduce((s, m) => s + m.liquidity, 0).toLocaleString()}` },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page heading */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Markets
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              Browse and trade active flight prediction markets.
            </p>
          </div>
          <Link
            href="/markets/create"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            + Create Market
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl px-5 py-4"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        <TrendingMarkets />

        {/* Market grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAMPLE_MARKETS.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
