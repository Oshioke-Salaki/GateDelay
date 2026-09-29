"use client";

import { usePriceUpdates } from "@/hooks/usePriceUpdates";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import PriceDisplay from "./PriceDisplay";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Market {
    id: string;
    name: string;
    description: string;
}

interface MarketPriceListProps {
    markets: Market[];
    onMarketClick?: (marketId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketPriceList({ markets, onMarketClick }: MarketPriceListProps) {
    const websocket = useWebSocketContext();
    const marketIds = markets.map((m) => m.id);
    const { prices, isLoading, isConnected, connectionStatus } = usePriceUpdates({
        marketIds,
        autoSubscribe: true,
    });

    // ─── Connection Status Badge ──────────────────────────────────────────────

    const statusBadge = () => {
        const statusConfig = {
            connected: { text: "Live", color: "bg-green-500", pulse: true },
            connecting: { text: "Connecting...", color: "bg-yellow-500", pulse: true },
            disconnected: { text: "Offline", color: "bg-gray-500", pulse: false },
            error: { text: "Error", color: "bg-red-500", pulse: false },
        };

        const config = statusConfig[connectionStatus];

        return (
            <div className="mb-4 flex flex-wrap items-center gap-3" aria-live="polite">
                <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? "animate-pulse" : ""}`} />
                    <span className="text-sm text-gray-600">{config.text}</span>
                </div>
                {connectionStatus === "error" && (
                    <span className="text-xs text-gray-500">
                        {websocket.error?.message || "Using fallback mode"}
                    </span>
                )}
                {connectionStatus !== "connected" && (
                    <button
                        type="button"
                        onClick={websocket.connect}
                        disabled={connectionStatus === "connecting"}
                        className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Retry price feed connection"
                    >
                        {connectionStatus === "connecting" ? "Retrying..." : "Retry"}
                    </button>
                )}
            </div>
        );
    };

    // ─── Loading State ────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="space-y-2">
                {markets.map((market) => (
                    <div key={market.id} className="bg-white p-4 rounded-lg shadow animate-pulse">
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                ))}
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div>
            {statusBadge()}
            <div className="space-y-2">
                {markets.map((market) => {
                    const priceData = prices.get(market.id);

                    return (
                        <div
                            key={market.id}
                            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onMarketClick?.(market.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1">{market.name}</h3>
                                    <p className="text-sm text-gray-600">{market.description}</p>
                                </div>
                                <div className="ml-4">
                                    {priceData ? (
                                        <PriceDisplay marketId={market.id} showChange showVolume size="md" />
                                    ) : (
                                        <div className="text-sm text-gray-400">No price data</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
