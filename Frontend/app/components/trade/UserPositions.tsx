"use client";

import { useState, useEffect } from "react";
import CloseConfirmation from "@/components/position/CloseConfirmation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position {
    id: string;
    side: "long" | "short";
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    value: number;
    pnl: number;
    pnlPercent: number;
    timestamp: number;
}

interface UserPositionsProps {
    marketId: string;
    userAddress: string;
}

// ─── User Positions ───────────────────────────────────────────────────────────

export default function UserPositions({ marketId, userAddress }: UserPositionsProps) {
    const [positions, setPositions] = useState<Position[]>([]);
    const [activeTab, setActiveTab] = useState<"open" | "history">("open");
    const [closingPos, setClosingPos] = useState<Position | null>(null);

    useEffect(() => {
        // Mock data - in production, fetch from API
        const mockPositions: Position[] = [
            {
                id: "pos-1",
                side: "long",
                entryPrice: 0.95,
                currentPrice: 1.0,
                quantity: 1000,
                value: 1000,
                pnl: 50,
                pnlPercent: 5.26,
                timestamp: Date.now() - 3600000,
            },
            {
                id: "pos-2",
                side: "short",
                entryPrice: 1.05,
                currentPrice: 1.0,
                quantity: 500,
                value: 500,
                pnl: 25,
                pnlPercent: 4.76,
                timestamp: Date.now() - 7200000,
            },
        ];

        setPositions(mockPositions);
    }, [marketId, userAddress]);

    const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);

    return (
        <div className="bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Your Positions</h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm">
                        <span className="text-gray-600">
                            Total Value: <span className="font-semibold">${totalValue.toFixed(2)}</span>
                        </span>
                        <span
                            className={`font-semibold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            P&L: {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)} (
                            {((totalPnL / totalValue) * 100).toFixed(2)}%)
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab("open")}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${activeTab === "open"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                    >
                        Open Positions
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${activeTab === "history"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                    >
                        History
                    </button>
                </div>
            </div>

            {/* Positions Table */}
            {activeTab === "open" && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                    Side
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    Entry Price
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    Current Price
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    Quantity
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    Value
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    P&L
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        No open positions
                                    </td>
                                </tr>
                            ) : (
                                positions.map((position) => (
                                    <tr key={position.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${position.side === "long"
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-red-100 text-red-800"
                                                    }`}
                                            >
                                                {position.side.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm">
                                            ${position.entryPrice.toFixed(4)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm">
                                            ${position.currentPrice.toFixed(4)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm">
                                            {position.quantity.toFixed(0)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                                            ${position.value.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div
                                                className={`font-mono text-sm font-semibold ${position.pnl >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                            >
                                                {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                                            </div>
                                            <div
                                                className={`text-xs ${position.pnl >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                            >
                                                ({position.pnlPercent >= 0 ? "+" : ""}
                                                {position.pnlPercent.toFixed(2)}%)
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => setClosingPos(position)}
                                                className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                Close
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
                <div className="p-8 text-center text-gray-500">
                    <p>No trading history yet</p>
                </div>
            )}

            {closingPos && (
                <CloseConfirmation
                    isOpen={!!closingPos}
                    onClose={() => setClosingPos(null)}
                    onConfirm={async (sharesToClose) => {
                        // Simulate partial position close on mock data
                        setPositions(prev =>
                            prev
                                .map(pos => {
                                    if (pos.id === closingPos.id) {
                                        const nextQty = pos.quantity - sharesToClose;
                                        if (nextQty <= 0.0001) return null; // fully closed
                                        const nextValue = nextQty * pos.currentPrice;
                                        const nextPnl = (pos.currentPrice - pos.entryPrice) * nextQty;
                                        const nextPnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                                        return {
                                            ...pos,
                                            quantity: nextQty,
                                            value: nextValue,
                                            pnl: nextPnl,
                                            pnlPercent: nextPnlPercent,
                                        };
                                    }
                                    return pos;
                                })
                                .filter(Boolean) as Position[]
                        );
                        setClosingPos(null);
                    }}
                    position={{
                        id: closingPos.id,
                        marketName: `Market Position (${closingPos.side.toUpperCase()})`,
                        side: closingPos.side === "long" ? "YES" : "NO",
                        shares: closingPos.quantity,
                        entryPrice: closingPos.entryPrice,
                        currentPrice: closingPos.currentPrice,
                    }}
                />
            )}
        </div>
    );
}
