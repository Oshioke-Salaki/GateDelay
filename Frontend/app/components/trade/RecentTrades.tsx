"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
    id: string;
    price: number;
    quantity: number;
    total: number;
    side: "buy" | "sell";
    timestamp: number;
}

interface RecentTradesProps {
    marketId: string;
}

// ─── Recent Trades ────────────────────────────────────────────────────────────

export default function RecentTrades({ marketId }: RecentTradesProps) {
    const [trades, setTrades] = useState<Trade[]>([]);

    useEffect(() => {
        // Mock data - in production, fetch from WebSocket
        const mockTrades: Trade[] = Array.from({ length: 20 }, (_, i) => {
            const side = Math.random() > 0.5 ? "buy" : "sell";
            const price = 1.0 + (Math.random() - 0.5) * 0.02;
            const quantity = Math.floor(Math.random() * 1000) + 100;

            return {
                id: `trade-${i}`,
                price,
                quantity,
                total: price * quantity,
                side,
                timestamp: Date.now() - i * 60000,
            };
        });

        setTrades(mockTrades);
    }, [marketId]);

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Recent Trades</h3>
            </div>

            {/* Column Headers */}
            <div className="flex items-center justify-between px-2 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
                <span className="w-20">Time</span>
                <span className="w-24 text-right">Price</span>
                <span className="w-24 text-right">Amount</span>
                <span className="w-24 text-right">Total</span>
            </div>

            {/* Trades List */}
            <div className="max-h-96 overflow-y-auto">
                {trades.map((trade) => (
                    <div
                        key={trade.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 text-sm"
                    >
                        <span className="w-20 text-xs text-gray-500">{formatTime(trade.timestamp)}</span>
                        <span
                            className={`w-24 text-right font-mono font-medium ${trade.side === "buy" ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            ${trade.price.toFixed(4)}
                        </span>
                        <span className="w-24 text-right font-mono text-gray-700">
                            {trade.quantity.toFixed(0)}
                        </span>
                        <span className="w-24 text-right font-mono text-gray-500">
                            ${trade.total.toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                        Buy Volume: $
                        {trades
                            .filter((t) => t.side === "buy")
                            .reduce((sum, t) => sum + t.total, 0)
                            .toFixed(0)}
                    </span>
                    <span>
                        Sell Volume: $
                        {trades
                            .filter((t) => t.side === "sell")
                            .reduce((sum, t) => sum + t.total, 0)
                            .toFixed(0)}
                    </span>
                </div>
            </div>
        </div>
    );
}
