"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useWebSocket, PriceUpdate, WebSocketState } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebSocketContextValue extends WebSocketState {
    subscribe: (marketIds: string[]) => void;
    unsubscribe: (marketIds: string[]) => void;
    connect: () => void;
    disconnect: () => void;
    prices: Map<string, PriceUpdate>;
    getPrice: (marketId: string) => PriceUpdate | undefined;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface WebSocketProviderProps {
    children: ReactNode;
    backendUrl?: string;
    authToken?: string;
    enablePollingFallback?: boolean;
}

export function WebSocketProvider({
    children,
    backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000",
    authToken,
    enablePollingFallback = true,
}: WebSocketProviderProps) {
    const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
    const [hasShownConnectionError, setHasShownConnectionError] = useState(false);
    const toast = useToast();

    const websocket = useWebSocket({
        url: backendUrl,
        namespace: "/prices",
        auth: authToken ? { token: authToken } : undefined,
        autoConnect: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        fallbackToPolling: enablePollingFallback,
        pollingInterval: 30000,
    });

    // ─── Handle Price Updates ─────────────────────────────────────────────────

    useEffect(() => {
        const unsubscribe = websocket.on("priceUpdate", (data: PriceUpdate) => {
            setPrices((prev) => {
                const updated = new Map(prev);
                updated.set(data.marketId, data);
                return updated;
            });
        });

        return unsubscribe;
    }, [websocket]);

    // ─── Handle Market Data ───────────────────────────────────────────────────

    useEffect(() => {
        const unsubscribe = websocket.on("marketData", (data: Record<string, any>) => {
            console.log("[WebSocket] Market data received:", data);
            // Handle general market data updates
        });

        return unsubscribe;
    }, [websocket]);

    // ─── Handle Polling Fallback ──────────────────────────────────────────────

    useEffect(() => {
        const unsubscribe = websocket.on("polling", async (data: { marketIds: string[] }) => {
            console.log("[WebSocket] Polling fallback triggered for:", data.marketIds);

            try {
                // Fetch prices via REST API as fallback
                const response = await fetch(`${backendUrl}/api/market-data/prices`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(authToken && { Authorization: `Bearer ${authToken}` }),
                    },
                    body: JSON.stringify({ marketIds: data.marketIds }),
                });

                if (response.ok) {
                    const pricesData: PriceUpdate[] = await response.json();
                    setPrices((prev) => {
                        const updated = new Map(prev);
                        pricesData.forEach((priceUpdate) => {
                            updated.set(priceUpdate.marketId, priceUpdate);
                        });
                        return updated;
                    });
                }
            } catch (error) {
                console.error("[WebSocket] Polling fallback error:", error);
            }
        });

        return unsubscribe;
    }, [websocket, backendUrl, authToken]);

    // ─── Connection Status Notifications ──────────────────────────────────────

    useEffect(() => {
        if (websocket.status === "connected") {
            if (hasShownConnectionError) {
                toast.success("Connected", "Real-time updates restored");
                setHasShownConnectionError(false);
            }
        } else if (websocket.status === "error" && !hasShownConnectionError) {
            if (enablePollingFallback) {
                toast.warning(
                    "Connection Issue",
                    "Using fallback mode. Some features may be delayed.",
                    { duration: 7000 }
                );
            } else {
                toast.error(
                    "Connection Lost",
                    "Unable to connect to real-time updates. Please refresh the page.",
                    { duration: 0 }
                );
            }
            setHasShownConnectionError(true);
        }
    }, [websocket.status, hasShownConnectionError, enablePollingFallback, toast]);

    // ─── Helper Functions ─────────────────────────────────────────────────────

    const getPrice = (marketId: string): PriceUpdate | undefined => {
        return prices.get(marketId);
    };

    // ─── Context Value ────────────────────────────────────────────────────────

    const value: WebSocketContextValue = {
        status: websocket.status,
        error: websocket.error,
        isConnected: websocket.isConnected,
        lastUpdate: websocket.lastUpdate,
        subscribe: websocket.subscribe,
        unsubscribe: websocket.unsubscribe,
        connect: websocket.connect,
        disconnect: websocket.disconnect,
        prices,
        getPrice,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocketContext(): WebSocketContextValue {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error("useWebSocketContext must be used within WebSocketProvider");
    }
    return context;
}
