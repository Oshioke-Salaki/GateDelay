"use client";

import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import TradingInterface, { Market } from "@/app/components/trade/TradingInterface";

// ─── Mock Market Data ─────────────────────────────────────────────────────────

const MOCK_MARKETS: Record<string, Market> = {
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

// ─── Trade Page ───────────────────────────────────────────────────────────────

export default function TradePage({ params }: { params: { id: string } }) {
    const market = MOCK_MARKETS[params.id] || MOCK_MARKETS["market-1"];

    // Mock user address - in production, get from wallet connection
    const userAddress = "0x1234567890abcdef1234567890abcdef12345678";

    return (
        <PageErrorBoundary>
            <TradingInterface market={market} userAddress={userAddress} />
        </PageErrorBoundary>
    );
}
