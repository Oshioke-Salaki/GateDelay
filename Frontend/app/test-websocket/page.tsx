"use client";

import { useState } from "react";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import { usePriceUpdates } from "@/hooks/usePriceUpdates";
import PriceDisplay from "@/app/components/market/PriceDisplay";
import MarketPriceList from "@/app/components/market/MarketPriceList";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MARKETS = [
    {
        id: "market-1",
        name: "AA 1234 - JFK to LAX",
        description: "Will this flight be delayed by more than 30 minutes?",
    },
    {
        id: "market-2",
        name: "UA 5678 - SFO to ORD",
        description: "Will this flight be cancelled?",
    },
    {
        id: "market-3",
        name: "DL 9012 - ATL to MIA",
        description: "Will this flight depart on time?",
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestWebSocketPage() {
    const websocket = useWebSocketContext();
    const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
    const [customMarketId, setCustomMarketId] = useState("");

    // ─── Connection Status ────────────────────────────────────────────────────

    const statusColors = {
        connected: "bg-green-100 text-green-800 border-green-300",
        connecting: "bg-yellow-100 text-yellow-800 border-yellow-300",
        disconnected: "bg-gray-100 text-gray-800 border-gray-300",
        error: "bg-red-100 text-red-800 border-red-300",
    };

    // ─── Manual Controls ──────────────────────────────────────────────────────

    const handleConnect = () => {
        websocket.connect();
    };

    const handleDisconnect = () => {
        websocket.disconnect();
    };

    const handleSubscribe = () => {
        if (customMarketId.trim()) {
            websocket.subscribe([customMarketId.trim()]);
            setCustomMarketId("");
        }
    };

    const handleUnsubscribe = () => {
        if (customMarketId.trim()) {
            websocket.unsubscribe([customMarketId.trim()]);
            setCustomMarketId("");
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8">WebSocket Real-Time Updates Test</h1>

            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
                <div className="space-y-3">
                    <div className="flex items-center space-x-4">
                        <span className="font-medium w-32">Status:</span>
                        <span
                            className={`px-4 py-2 rounded-lg border ${statusColors[websocket.status]}`}
                        >
                            {websocket.status.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="font-medium w-32">Connected:</span>
                        <span className={websocket.isConnected ? "text-green-600" : "text-red-600"}>
                            {websocket.isConnected ? "Yes" : "No"}
                        </span>
                    </div>
                    {websocket.lastUpdate && (
                        <div className="flex items-center space-x-4">
                            <span className="font-medium w-32">Last Update:</span>
                            <span className="text-gray-600">
                                {new Date(websocket.lastUpdate).toLocaleTimeString()}
                            </span>
                        </div>
                    )}
                    {websocket.error && (
                        <div className="flex items-center space-x-4">
                            <span className="font-medium w-32">Error:</span>
                            <span className="text-red-600">{websocket.error.message}</span>
                        </div>
                    )}
                </div>

                {/* Manual Controls */}
                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={handleConnect}
                        disabled={websocket.isConnected}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Connect
                    </button>
                    <button
                        onClick={handleDisconnect}
                        disabled={!websocket.isConnected}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Manual Subscription */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Manual Subscription</h2>
                <div className="flex space-x-3">
                    <input
                        type="text"
                        value={customMarketId}
                        onChange={(e) => setCustomMarketId(e.target.value)}
                        placeholder="Enter market ID (e.g., market-1)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleSubscribe}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Subscribe
                    </button>
                    <button
                        onClick={handleUnsubscribe}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                        Unsubscribe
                    </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                    Try subscribing to: market-1, market-2, market-3
                </p>
            </div>

            {/* Market Price List */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Market Prices (Auto-Subscribe)</h2>
                <MarketPriceList
                    markets={MOCK_MARKETS}
                    onMarketClick={(marketId) => setSelectedMarket(marketId)}
                />
            </div>

            {/* Individual Price Displays */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Individual Price Components</h2>
                <div className="space-y-4">
                    {MOCK_MARKETS.map((market) => (
                        <div key={market.id} className="border border-gray-200 rounded p-4">
                            <h3 className="font-medium mb-2">{market.name}</h3>
                            <PriceDisplay
                                marketId={market.id}
                                showChange
                                showVolume
                                size="lg"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected Market Detail */}
            {selectedMarket && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Selected Market Detail</h2>
                    <div className="space-y-2">
                        <p className="text-gray-600">Market ID: {selectedMarket}</p>
                        <PriceDisplay
                            marketId={selectedMarket}
                            showChange
                            showVolume
                            size="lg"
                        />
                    </div>
                    <button
                        onClick={() => setSelectedMarket(null)}
                        className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                <h2 className="text-xl font-semibold mb-4 text-blue-900">Testing Instructions</h2>
                <ol className="list-decimal list-inside space-y-2 text-blue-800">
                    <li>Verify the connection status shows "CONNECTED" (green)</li>
                    <li>Watch for real-time price updates with flash animations</li>
                    <li>Click "Disconnect" to test fallback to polling mode</li>
                    <li>Click "Connect" to restore WebSocket connection</li>
                    <li>Try subscribing to custom market IDs manually</li>
                    <li>Open browser console to see WebSocket logs</li>
                    <li>Test with multiple browser tabs to verify connection limits</li>
                </ol>
            </div>

            {/* Technical Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6">
                <h2 className="text-xl font-semibold mb-4">Technical Information</h2>
                <div className="space-y-2 text-sm font-mono">
                    <p>Backend URL: {process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000"}</p>
                    <p>WebSocket Namespace: /prices</p>
                    <p>Reconnect Attempts: 5</p>
                    <p>Reconnect Delay: 2000ms</p>
                    <p>Polling Interval: 30000ms</p>
                    <p>Polling Fallback: Enabled</p>
                </div>
            </div>
        </div>
    );
}
