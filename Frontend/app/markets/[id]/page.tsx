"use client";
import { useState, Suspense } from "react";
import { StatsSkeleton, ChartSkeleton } from "../../components/ui/Skeleton";

// Mock data — replace with real contract/API calls
const MOCK_MARKET = {
  id: "1",
  title: "Will AA123 arrive on time?",
  description: "American Airlines flight AA123 from JFK to LAX on Apr 25, 2026.",
  status: "open" as "open" | "closed" | "resolved",
  yesPrice: 0.62,
  noPrice: 0.38,
  volume: 14820,
  liquidity: 5400,
  participants: 87,
  recentTrades: [
    { side: "YES", amount: 50, price: 0.62, time: "2m ago" },
    { side: "NO", amount: 120, price: 0.38, time: "5m ago" },
    { side: "YES", amount: 200, price: 0.61, time: "11m ago" },
    { side: "NO", amount: 75, price: 0.39, time: "18m ago" },
    { side: "YES", amount: 300, price: 0.60, time: "25m ago" },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  open: "#22c55e",
  closed: "#f59e0b",
  resolved: "#6366f1",
};

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  const market = { ...MOCK_MARKET, id: params.id };
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");

  const price = side === "YES" ? market.yesPrice : market.noPrice;
  const shares = amount ? (parseFloat(amount) / price).toFixed(2) : "—";

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: STATUS_COLORS[market.status] + "22", color: STATUS_COLORS[market.status] }}
            >
              {market.status.toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>Market #{market.id}</span>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>{market.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{market.description}</p>
        </div>
      </div>

      {/* Stats */}
      <Suspense fallback={<StatsSkeleton count={4} />}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "YES Price", value: `${(market.yesPrice * 100).toFixed(0)}¢` },
          { label: "Volume", value: `$${market.volume.toLocaleString()}` },
          { label: "Liquidity", value: `$${market.liquidity.toLocaleString()}` },
          { label: "Participants", value: market.participants },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{s.value}</p>
          </div>
        ))}
      </div>
      </Suspense>

      {/* Chart placeholder */}
      <Suspense fallback={<ChartSkeleton height={192} />}>
      <div
        className="rounded-xl p-6 flex items-center justify-center h-48"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>Price chart coming soon</p>
      </div>
      </Suspense>

      {/* Trading interface + Recent trades */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Trade */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h2 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Place Trade</h2>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["YES", "NO"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  background: side === s ? (s === "YES" ? "#22c55e" : "#ef4444") : "transparent",
                  color: side === s ? "#fff" : "var(--muted)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Amount (USDC)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            />
          </div>
          <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
            <span>Price per share</span><span>{price.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
            <span>Estimated shares</span><span>{shares}</span>
          </div>
          <button
            disabled={!amount || market.status !== "open"}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: side === "YES" ? "#22c55e" : "#ef4444" }}
          >
            Buy {side}
          </button>
        </div>

        {/* Recent trades */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>Recent Trades</h2>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--muted)" }}>
                <th className="text-left pb-2">Side</th>
                <th className="text-right pb-2">Amount</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-right pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {market.recentTrades.map((t, i) => (
                <tr key={i} style={{ color: "var(--foreground)", borderTop: "1px solid var(--border)" }}>
                  <td className="py-1.5">
                    <span
                      className="font-semibold"
                      style={{ color: t.side === "YES" ? "#22c55e" : "#ef4444" }}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="text-right">${t.amount}</td>
                  <td className="text-right">{t.price.toFixed(2)}</td>
                  <td className="text-right" style={{ color: "var(--muted)" }}>{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
