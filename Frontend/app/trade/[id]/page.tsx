"use client";

import Link from "next/link";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { useConnectKitBridge } from "@/app/components/ConnectKitBridgeContext";
import TradingInterface, { Market } from "@/app/components/trade/TradingInterface";

/**
 * Local demo catalog for `/trade/[id]`.
 *
 * These rows are UI fixtures so the trading-interface shell can render without
 * a Backend or chain. They are not live LMSR/CLOB reads and must not be
 * documented as such. There is no `GET /api/markets/:id` proxy in this app.
 */
export const DEMO_TRADE_MARKETS: Record<string, Market> = {
    "market-1": {
        id: "market-1",
        name: "AA 1234 - JFK to LAX",
        description: "Will American Airlines flight 1234 from JFK to LAX be delayed by more than 30 minutes on Dec 25, 2026?",
        currentPrice: 1.0025,
        priceChange24h: 2.45,
        volume24h: 125000,
        high24h: 1.0150,
        low24h: 0.9850,
        totalLiquidity: 500000,
        expiryDate: "2026-12-25T23:59:59Z",
        status: "active",
    },
    "market-2": {
        id: "market-2",
        name: "UA 5678 - SFO to ORD",
        description: "Will United Airlines flight 5678 from SFO to ORD be cancelled on Dec 26, 2026?",
        currentPrice: 0.3500,
        priceChange24h: -1.25,
        volume24h: 85000,
        high24h: 0.3750,
        low24h: 0.3200,
        totalLiquidity: 350000,
        expiryDate: "2026-12-26T23:59:59Z",
        status: "active",
    },
    "market-3": {
        id: "market-3",
        name: "DL 9012 - ATL to MIA",
        description: "Will Delta flight 9012 from ATL to MIA depart on time on Dec 27, 2026?",
        currentPrice: 0.7500,
        priceChange24h: 0.85,
        volume24h: 95000,
        high24h: 0.7800,
        low24h: 0.7200,
        totalLiquidity: 420000,
        expiryDate: "2026-12-27T23:59:59Z",
        status: "active",
    },
};

export const DEMO_TRADE_MARKET_IDS = Object.keys(DEMO_TRADE_MARKETS);

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
