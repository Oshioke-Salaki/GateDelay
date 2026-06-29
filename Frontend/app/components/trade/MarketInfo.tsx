"use client";

import { Market } from "./TradingInterface";
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";

// ─── Market Info ──────────────────────────────────────────────────────────────

interface MarketInfoProps {
    market: Market;
}

export default function MarketInfo({ market }: MarketInfoProps) {
    const { price, isConnected } = useSinglePriceUpdate(market.id);

    const currentPrice = price?.currentPrice || market.currentPrice;
    const priceChange = price?.changePercent || market.priceChange24h;
    const volume = price?.volume || market.volume24h;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Market Title */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{market.name}</h1>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${market.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : market.status === "closed"
                                        ? "bg-gray-100 text-gray-800"
                                        : "bg-blue-100 text-blue-800"
                                }`}
                        >
                            {market.status.toUpperCase()}
                        </span>
                        {!isConnected && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                OFFLINE
                            </span>
                        )}
                    </div>
                    <p className="text-gray-600 text-sm">{market.description}</p>
                </div>
            </div>

            {/* Market Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Current Price */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Current Price</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(currentPrice)}</p>
                </div>

                {/* 24h Change */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">24h Change</p>
                    <p
                        className={`text-xl font-bold ${priceChange >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                    >
                        {priceChange >= 0 ? "+" : ""}
                        {priceChange.toFixed(2)}%
                    </p>
                </div>

                {/* 24h High */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">24h High</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(market.high24h)}</p>
                </div>

                {/* 24h Low */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">24h Low</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(market.low24h)}</p>
                </div>

                {/* 24h Volume */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">24h Volume</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(volume)}</p>
                </div>

                {/* Total Liquidity */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Liquidity</p>
                    <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(market.totalLiquidity)}
                    </p>
                </div>
            </div>

            {/* Expiry Date */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Market Expiry:</span>
                    <span className="font-semibold text-gray-900">
                        {new Date(market.expiryDate).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
}
