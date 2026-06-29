"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
    price: number;
    quantity: number;
    total: number;
}

interface OrderBookCompactProps {
    marketId: string;
    userAddress?: string;
}

// ─── Order Book Compact ───────────────────────────────────────────────────────

export default function OrderBookCompact({ marketId, userAddress }: OrderBookCompactProps) {
    const [bids, setBids] = useState<Order[]>([]);
    const [asks, setAsks] = useState<Order[]>([]);
    const [view, setView] = useState<"all" | "bids" | "asks">("all");

    useEffect(() => {
        // Mock data - in production, fetch from WebSocket
        const mockBids: Order[] = [
            { price: 0.9950, quantity: 1250, total: 1243.75 },
            { price: 0.9945, quantity: 850, total: 845.33 },
            { price: 0.9940, quantity: 2100, total: 2087.40 },
            { price: 0.9935, quantity: 500, total: 496.75 },
            { price: 0.9930, quantity: 1800, total: 1787.40 },
        ];

        const mockAsks: Order[] = [
            { price: 1.0050, quantity: 900, total: 904.50 },
            { price: 1.0055, quantity: 1500, total: 1508.25 },
            { price: 1.0060, quantity: 750, total: 754.50 },
            { price: 1.0065, quantity: 1200, total: 1207.80 },
            { price: 1.0070, quantity: 600, total: 604.20 },
        ];

        setBids(mockBids);
        setAsks(mockAsks);
    }, [marketId]);

    const maxQuantity = Math.max(
        ...bids.map((b) => b.quantity),
        ...asks.map((a) => a.quantity)
    );

    const renderOrderRow = (order: Order, isBid: boolean) => (
        <div
            key={order.price}
            className="relative flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 cursor-pointer group"
        >
            {/* Background bar */}
            <div
                className={`absolute inset-y-0 right-0 ${isBid ? "bg-green-50" : "bg-red-50"
                    } transition-all`}
                style={{ width: `${(order.quantity / maxQuantity) * 100}%` }}
            />

            {/* Content */}
            <div className="relative z-10 flex items-center justify-between w-full text-sm">
                <span
                    className={`font-mono font-medium ${isBid ? "text-green-600" : "text-red-600"
                        }`}
                >
                    ${order.price.toFixed(4)}
                </span>
                <span className="font-mono text-gray-700">{order.quantity.toFixed(0)}</span>
                <span className="font-mono text-gray-500">${order.total.toFixed(2)}</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Order Book</h3>

                {/* View Toggle */}
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setView("all")}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === "all"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setView("bids")}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === "bids"
                                ? "bg-white text-green-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                    >
                        Bids
                    </button>
                    <button
                        onClick={() => setView("asks")}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === "asks"
                                ? "bg-white text-red-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                    >
                        Asks
                    </button>
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center justify-between px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
                <span>Price (USD)</span>
                <span>Amount</span>
                <span>Total</span>
            </div>

            {/* Order Lists */}
            <div className="max-h-96 overflow-y-auto">
                {/* Asks (Sell Orders) */}
                {(view === "all" || view === "asks") && (
                    <div className="border-b border-gray-200">
                        {asks
                            .sort((a, b) => b.price - a.price)
                            .map((ask) => renderOrderRow(ask, false))}
                    </div>
                )}

                {/* Spread */}
                {view === "all" && bids.length > 0 && asks.length > 0 && (
                    <div className="bg-gray-100 py-2 px-2 text-center">
                        <div className="text-xs text-gray-600">Spread</div>
                        <div className="text-sm font-bold text-gray-900">
                            ${(asks[asks.length - 1].price - bids[0].price).toFixed(4)} (
                            {(
                                ((asks[asks.length - 1].price - bids[0].price) / bids[0].price) *
                                100
                            ).toFixed(2)}
                            %)
                        </div>
                    </div>
                )}

                {/* Bids (Buy Orders) */}
                {(view === "all" || view === "bids") && (
                    <div>{bids.map((bid) => renderOrderRow(bid, true))}</div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Total Bids: {bids.reduce((sum, b) => sum + b.quantity, 0).toFixed(0)}</span>
                    <span>Total Asks: {asks.reduce((sum, a) => sum + a.quantity, 0).toFixed(0)}</span>
                </div>
            </div>
        </div>
    );
}
