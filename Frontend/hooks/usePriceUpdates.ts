"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import { PriceUpdate } from "./useWebSocket";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceData {
    marketId: string;
    currentPrice: number;
    previousPrice: number;
    volume: number;
    timestamp: number;
    change: number;
    changePercent: number;
}

export interface UsePriceUpdatesOptions {
    /** Market IDs to subscribe to */
    marketIds: string[];
    /** Callback when prices update */
    onUpdate?: (prices: Map<string, PriceData>) => void;
    /** Enable automatic subscription management */
    autoSubscribe?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePriceUpdates(options: UsePriceUpdatesOptions) {
    const { marketIds, onUpdate, autoSubscribe = true } = options;
    const websocket = useWebSocketContext();

    const [priceData, setPriceData] = useState<Map<string, PriceData>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    // ─── Subscribe/Unsubscribe ────────────────────────────────────────────────

    useEffect(() => {
        if (!autoSubscribe || marketIds.length === 0) {
            setIsLoading(false);
            return;
        }

        // Subscribe to markets
        websocket.subscribe(marketIds);
        setIsLoading(false);

        // Unsubscribe on cleanup
        return () => {
            websocket.unsubscribe(marketIds);
        };
    }, [marketIds, autoSubscribe, websocket]);

    // ─── Update Price Data ────────────────────────────────────────────────────

    useEffect(() => {
        const updatedPrices = new Map<string, PriceData>();

        marketIds.forEach((marketId) => {
            const priceUpdate = websocket.getPrice(marketId);
            const existingData = priceData.get(marketId);

            if (priceUpdate) {
                const previousPrice = existingData?.currentPrice || priceUpdate.price;
                const change = priceUpdate.price - previousPrice;
                const changePercent = previousPrice !== 0 ? (change / previousPrice) * 100 : 0;

                updatedPrices.set(marketId, {
                    marketId,
                    currentPrice: priceUpdate.price,
                    previousPrice,
                    volume: priceUpdate.volume,
                    timestamp: priceUpdate.timestamp,
                    change,
                    changePercent,
                });
            } else if (existingData) {
                // Keep existing data if no update
                updatedPrices.set(marketId, existingData);
            }
        });

        if (updatedPrices.size > 0) {
            setPriceData(updatedPrices);
            onUpdate?.(updatedPrices);
        }
    }, [websocket.prices, marketIds, onUpdate]);

    // ─── Helper Functions ─────────────────────────────────────────────────────

    const getPrice = useCallback(
        (marketId: string): PriceData | undefined => {
            return priceData.get(marketId);
        },
        [priceData]
    );

    const getCurrentPrice = useCallback(
        (marketId: string): number | undefined => {
            return priceData.get(marketId)?.currentPrice;
        },
        [priceData]
    );

    const getPriceChange = useCallback(
        (marketId: string): { change: number; changePercent: number } | undefined => {
            const data = priceData.get(marketId);
            if (!data) return undefined;
            return {
                change: data.change,
                changePercent: data.changePercent,
            };
        },
        [priceData]
    );

    // ─── Return ───────────────────────────────────────────────────────────────

    return {
        prices: priceData,
        isLoading,
        isConnected: websocket.isConnected,
        connectionStatus: websocket.status,
        getPrice,
        getCurrentPrice,
        getPriceChange,
        subscribe: websocket.subscribe,
        unsubscribe: websocket.unsubscribe,
    };
}

// ─── Single Market Hook ───────────────────────────────────────────────────────

export function useSinglePriceUpdate(marketId: string) {
    const { prices, isLoading, isConnected, connectionStatus, getPrice } = usePriceUpdates({
        marketIds: [marketId],
        autoSubscribe: true,
    });

    return {
        price: getPrice(marketId),
        isLoading,
        isConnected,
        connectionStatus,
    };
}
