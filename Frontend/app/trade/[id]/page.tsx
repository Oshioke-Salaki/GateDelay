"use client";

import Link from "next/link";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { useConnectKitBridge } from "@/app/components/ConnectKitBridgeContext";
import TradingInterface, { Market } from "@/app/components/trade/TradingInterface";

// Re-export under the original names so any existing imports keep working
// until a real market data source is wired for `/trade/[id]`.
export const DEMO_TRADE_MARKETS: Record<string, Market> =
  {};

export const DEMO_TRADE_MARKET_IDS: string[] = [];

export default function TradePage({ params }: { params: { id: string } }) {
  const { address } = useConnectKitBridge();
  const market = DEMO_TRADE_MARKETS[params.id];

  if (!market) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Market not found
        </h1>
        <p style={{ color: "var(--muted)" }}>
          No demo market is registered for{" "}
          <code className="font-mono">{params.id}</code>. The trading
          interface does not invent a substitute row or fall back to
          another market.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Known demo IDs: {DEMO_TRADE_MARKET_IDS.join(", ")}.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/trade/market-1"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#3b82f6" }}
          >
            Open market-1
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Back to Markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PageErrorBoundary>
      <TradingInterface market={market} userAddress={address} />
    </PageErrorBoundary>
  );
}
