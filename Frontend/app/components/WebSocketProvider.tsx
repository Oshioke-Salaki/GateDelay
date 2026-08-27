"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useWebSocket, PriceUpdate, WebSocketState } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/useToast";
import { resolveBackendUrl, MissingBackendUrlError } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebSocketContextValue extends WebSocketState {
    subscribe: (marketIds: string[]) => void;
    unsubscribe: (marketIds: string[]) => void;
    connect: () => void;
    disconnect: () => void;
    on: (event: string, callback: (data: any) => void) => () => void;
    off: (event: string, callback: (data: any) => void) => void;
    prices: Map<string, PriceUpdate>;
    getPrice: (marketId: string) => PriceUpdate | undefined;
    /** Explicit config fault (e.g. missing NEXT_PUBLIC_BACKEND_URL in production). */
    configError: string | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

function readBackendUrl(override?: string): { url: string | null; configError: string | null } {
    if (override?.trim()) {
        return { url: override.replace(/\/+$/, ""), configError: null };
    }
    try {
        return { url: resolveBackendUrl(), configError: null };
    } catch (error) {
        if (error instanceof MissingBackendUrlError) {
            return { url: null, configError: error.message };
        }
        throw error;
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface WebSocketProviderProps {
    children: ReactNode;
    backendUrl?: string;
    authToken?: string;
    enablePollingFallback?: boolean;
}

export function WebSocketProvider({
    children,
    backendUrl: backendUrlProp,
    authToken,
    enablePollingFallback = true,
}: WebSocketProviderProps) {
    const { url: backendUrl, configError } = useMemo(
        () => readBackendUrl(backendUrlProp),
        [backendUrlProp],
    );
    const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
    const [hasShownConnectionError, setHasShownConnectionError] = useState(false);
    const toast = useToast();

    const websocket = useWebSocket({
        // Empty string keeps the hook inert when config is missing in production.
        url: backendUrl ?? "",
        namespace: "/prices",
        auth: authToken ? { token: authToken } : undefined,
        autoConnect: Boolean(backendUrl),
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        fallbackToPolling: enablePollingFallback && Boolean(backendUrl),
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
        if (!backendUrl) return;

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
        if (configError && !hasShownConnectionError) {
            toast.error("WebSocket misconfigured", configError, { duration: 0 });
            setHasShownConnectionError(true);
            return;
        }

        if (websocket.status === "connected") {
            if (hasShownConnectionError) {
                toast.success("Connected", "Real-time updates restored");
                setHasShownConnectionError(false);
            }
        } else if (websocket.status === "error" && !hasShownConnectionError) {
            const detail =
                websocket.error?.message ||
                `Unable to reach ${backendUrl} (namespace /prices). Check NEXT_PUBLIC_BACKEND_URL and Backend PORT.`;
            if (enablePollingFallback) {
                toast.warning(
                    "WebSocket connection failed",
                    `${detail} Falling back to REST polling; live prices may be delayed.`,
                    { duration: 10000 }
                );
            } else {
                toast.error(
                    "WebSocket connection failed",
                    detail,
                    { duration: 0 }
                );
            }
            setHasShownConnectionError(true);
        }
    }, [websocket.status, hasShownConnectionError, enablePollingFallback, toast, configError]);
    // ─── Helper Functions ─────────────────────────────────────────────────────

    const getPrice = (marketId: string): PriceUpdate | undefined => {
        return prices.get(marketId);
    };

    // ─── Context Value ────────────────────────────────────────────────────────

    const value: WebSocketContextValue = {
        status: configError ? "error" : websocket.status,
        error: configError ? new Error(configError) : websocket.error,
        isConnected: Boolean(backendUrl) && websocket.isConnected,
        lastUpdate: websocket.lastUpdate,
        subscribe: websocket.subscribe,
        unsubscribe: websocket.unsubscribe,
        connect: websocket.connect,
        disconnect: websocket.disconnect,
        on: websocket.on,
        off: websocket.off,
        prices,
        getPrice,
        configError,
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
