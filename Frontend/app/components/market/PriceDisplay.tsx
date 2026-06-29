"use client";

import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceDisplayProps {
    marketId: string;
    showChange?: boolean;
    showVolume?: boolean;
    className?: string;
    size?: "sm" | "md" | "lg";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PriceDisplay({
    marketId,
    showChange = true,
    showVolume = false,
    className = "",
    size = "md",
}: PriceDisplayProps) {
    const { price, isLoading, isConnected } = useSinglePriceUpdate(marketId);
    const [flashClass, setFlashClass] = useState("");

    // ─── Flash Animation on Price Change ──────────────────────────────────────

    useEffect(() => {
        if (!price) return;

        if (price.change > 0) {
            setFlashClass("animate-flash-green");
        } else if (price.change < 0) {
            setFlashClass("animate-flash-red");
        }

        const timer = setTimeout(() => setFlashClass(""), 500);
        return () => clearTimeout(timer);
    }, [price?.currentPrice]);

    // ─── Size Classes ─────────────────────────────────────────────────────────

    const sizeClasses = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-2xl font-bold",
    };

    // ─── Loading State ────────────────────────────────────────────────────────

    if (isLoading || !price) {
        return (
            <div className={`flex items-center space-x-2 ${className}`}>
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />
                {showChange && <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />}
            </div>
        );
    }

    // ─── Price Change Indicator ───────────────────────────────────────────────

    const changeColor = price.change > 0 ? "text-green-600" : price.change < 0 ? "text-red-600" : "text-gray-600";
    const changeIcon = price.change > 0 ? "↑" : price.change < 0 ? "↓" : "";

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className={`flex items-center space-x-3 ${className}`}>
            {/* Current Price */}
            <div className="flex items-center space-x-1">
                <span className={`font-mono ${sizeClasses[size]} ${flashClass} transition-colors`}>
                    ${price.currentPrice.toFixed(4)}
                </span>
                {!isConnected && (
                    <span className="text-xs text-yellow-600" title="Offline mode">
                        ⚠
                    </span>
                )}
            </div>

            {/* Price Change */}
            {showChange && (
                <div className={`flex items-center space-x-1 ${changeColor} text-sm`}>
                    <span>{changeIcon}</span>
                    <span className="font-medium">
                        {price.change >= 0 ? "+" : ""}
                        {price.change.toFixed(4)}
                    </span>
                    <span className="text-xs">
                        ({price.changePercent >= 0 ? "+" : ""}
                        {price.changePercent.toFixed(2)}%)
                    </span>
                </div>
            )}

            {/* Volume */}
            {showVolume && (
                <div className="text-sm text-gray-600">
                    Vol: <span className="font-mono">{price.volume.toLocaleString()}</span>
                </div>
            )}
        </div>
    );
}
