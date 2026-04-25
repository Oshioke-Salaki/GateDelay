"use client";
import { useState, Suspense } from "react";
import { StatsSkeleton, ChartSkeleton } from "../../components/ui/Skeleton";
import StatusIndicator from "../../components/market/StatusIndicator";
import OrderBook from "../../components/market/OrderBook";
import TradeConfirmation from "../../../components/trade/TradeConfirmation";
import LiquidityDisplay from "../../../components/market/LiquidityDisplay";
import { useAccount } from "wagmi";
import PriceChart from "../../components/chart/PriceChart";

// Mock data — replace with real contract/API calls
const MOCK_MARKET = {
  id: "1",
  title: "Will AA123 arrive on time?",
  description: "American Airlines flight AA123 from JFK to LAX on Apr 25, 2026.",
  status: "open" as "open" | "closed" | "resolved" | "disputed",
  yesPrice: 0.62,
  noPrice: 0.38,
  volume: 14820,
  liquidity: 5400,
  participants: 87,
  resolvedAt: undefined as string | undefined,
  outcome: undefined as "YES" | "NO" | undefined,
  recentTrades: [
    { side: "YES", amount: 50, price: 0.62, time: "2m ago" },
    { side: "NO", amount: 120, price: 0.38, time: "5m ago" },
    { side: "YES", amount: 200, price: 0.61, time: "11m ago" },
    { side: "NO", amount: 75, price: 0.39, time: "18m ago" },
    { side: "YES", amount: 300, price: 0.60, time: "25m ago" },
  ],
};

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  const { address } = useAccount();
  const market = { ...MOCK_MARKET, id: params.id };
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const amountValue = parseFloat(amount) || 0;
  const price = side === "YES" ? market.yesPrice : market.noPrice;
  const shares = amountValue > 0 ? (amountValue / price).toFixed(2) : "—";
  const isTradeValid = amountValue > 0 && market.status === "open";

  const openConfirmation = () => {
    if (isTradeValid) {
      setIsConfirmationOpen(true);
    }
  };

  const handleConfirmTrade = () => {
    setIsConfirmationOpen(false);
    setConfirmationMessage(`Confirmed ${side} trade for ${amountValue.toFixed(2)} USDC at ${price.toFixed(2)} USDC per share.`);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusIndicator
              status={market.status}
              resolvedAt={market.resolvedAt}
              outcome={market.outcome}
              variant="full"
            />
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

      {/* Price chart */}
      <Suspense fallback={<ChartSkeleton height={300} />}>
        <PriceChart />
      </Suspense>

      {/* Liquidity display */}
      <LiquidityDisplay marketId={params.id} />

      {/* Order Book */}
      <OrderBook marketId={params.id} userAddress={address} />

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
          {confirmationMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {confirmationMessage}
            </div>
          ) : null}
          <button
            disabled={!isTradeValid}
            onClick={openConfirmation}
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

      <TradeConfirmation
        isOpen={isConfirmationOpen}
        side={side}
        amount={amountValue}
        price={price}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmTrade}
      />
    </main>
  );
}
