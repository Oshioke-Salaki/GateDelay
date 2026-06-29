"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebSocketConfig {
    url: string;
    namespace?: string;
    auth?: {
        token?: string;
    };
    autoConnect?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    fallbackToPolling?: boolean;
    pollingInterval?: number;
}

export interface PriceUpdate {
    marketId: string;
    price: number;
    volume: number;
    timestamp: number;
}

export interface MarketData {
    [key: string]: unknown;
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

export interface WebSocketState {
    status: ConnectionStatus;
    error: Error | null;
    isConnected: boolean;
    lastUpdate: number | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(config: WebSocketConfig) {
    const [state, setState] = useState<WebSocketState>({
        status: "disconnected",
        error: null,
        isConnected: false,
        lastUpdate: null,
    });

    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const subscribedMarketsRef = useRef<Set<string>>(new Set());
    const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

    const maxReconnectAttempts = config.reconnectionAttempts ?? 5;
    const reconnectionDelay = config.reconnectionDelay ?? 1000;
    const pollingInterval = config.pollingInterval ?? 30000;

    // ─── Connect ──────────────────────────────────────────────────────────────

    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            return;
        }

        setState((prev) => ({ ...prev, status: "connecting", error: null }));

        try {
            const socketUrl = `${config.url}${config.namespace || ""}`;
            const socket = io(socketUrl, {
                auth: config.auth || {},
                autoConnect: config.autoConnect ?? true,
                reconnection: true,
                reconnectionAttempts: maxReconnectAttempts,
                reconnectionDelay,
                transports: ["websocket", "polling"],
            });

            socket.on("connect", () => {
                console.log("[WebSocket] Connected");
                reconnectAttemptsRef.current = 0;
                setState({
                    status: "connected",
                    error: null,
                    isConnected: true,
                    lastUpdate: Date.now(),
                });

                // Resubscribe to markets after reconnection
                if (subscribedMarketsRef.current.size > 0) {
                    socket.emit("subscribe", {
                        marketIds: Array.from(subscribedMarketsRef.current),
                    });
                }

                // Clear polling fallback if active
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
            });

            socket.on("disconnect", (reason) => {
                console.log("[WebSocket] Disconnected:", reason);
                setState((prev) => ({
                    ...prev,
                    status: "disconnected",
                    isConnected: false,
                }));

                // Start polling fallback if enabled
                if (config.fallbackToPolling && !pollingIntervalRef.current) {
                    startPollingFallback();
                }
            });

            socket.on("connect_error", (error) => {
                console.error("[WebSocket] Connection error:", error);
                reconnectAttemptsRef.current++;

                setState({
                    status: "error",
                    error: error as Error,
                    isConnected: false,
                    lastUpdate: null,
                });

                if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
                    console.log("[WebSocket] Max reconnection attempts reached");
                    socket.disconnect();

                    // Start polling fallback if enabled
                    if (config.fallbackToPolling) {
                        startPollingFallback();
                    }
                }
            });

            socket.on("error", (error) => {
                console.error("[WebSocket] Error:", error);
                setState((prev) => ({
                    ...prev,
                    error: error as Error,
                }));
            });

            socketRef.current = socket;
        } catch (error) {
            console.error("[WebSocket] Failed to create socket:", error);
            setState({
                status: "error",
                error: error as Error,
                isConnected: false,
                lastUpdate: null,
            });
        }
    }, [config, maxReconnectAttempts, reconnectionDelay]);

    // ─── Disconnect ───────────────────────────────────────────────────────────

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        setState({
            status: "disconnected",
            error: null,
            isConnected: false,
            lastUpdate: null,
        });
    }, []);

    // ─── Polling Fallback ─────────────────────────────────────────────────────

    const startPollingFallback = useCallback(() => {
        console.log("[WebSocket] Starting polling fallback");

        pollingIntervalRef.current = setInterval(() => {
            // Trigger polling event for subscribed markets
            const markets = Array.from(subscribedMarketsRef.current);
            if (markets.length > 0) {
                const pollingListeners = listenersRef.current.get("polling");
                if (pollingListeners) {
                    pollingListeners.forEach((listener) => listener({ marketIds: markets }));
                }
            }
        }, pollingInterval);
    }, [pollingInterval]);

    // ─── Subscribe to Markets ─────────────────────────────────────────────────

    const subscribe = useCallback((marketIds: string[]) => {
        if (!socketRef.current?.connected) {
            console.warn("[WebSocket] Cannot subscribe: not connected");
            marketIds.forEach((id) => subscribedMarketsRef.current.add(id));
            return;
        }

        marketIds.forEach((id) => subscribedMarketsRef.current.add(id));

        socketRef.current.emit("subscribe", { marketIds }, (response: any) => {
            if (response?.error) {
                console.error("[WebSocket] Subscribe error:", response.error);
            } else {
                console.log("[WebSocket] Subscribed to:", response?.subscribed || marketIds);
            }
        });
    }, []);

    // ─── Unsubscribe from Markets ─────────────────────────────────────────────

    const unsubscribe = useCallback((marketIds: string[]) => {
        if (!socketRef.current?.connected) {
            marketIds.forEach((id) => subscribedMarketsRef.current.delete(id));
            return;
        }

        marketIds.forEach((id) => subscribedMarketsRef.current.delete(id));

        socketRef.current.emit("unsubscribe", { marketIds }, (response: any) => {
            if (response?.error) {
                console.error("[WebSocket] Unsubscribe error:", response.error);
            } else {
                console.log("[WebSocket] Unsubscribed from:", marketIds);
            }
        });
    }, []);

    // ─── Event Listeners ──────────────────────────────────────────────────────

    const on = useCallback((event: string, callback: (data: any) => void) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event)!.add(callback);

        if (socketRef.current) {
            socketRef.current.on(event, callback);
        }

        return () => {
            listenersRef.current.get(event)?.delete(callback);
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
        };
    }, []);

    const off = useCallback((event: string, callback: (data: any) => void) => {
        listenersRef.current.get(event)?.delete(callback);
        if (socketRef.current) {
            socketRef.current.off(event, callback);
        }
    }, []);

    // ─── Emit Events ──────────────────────────────────────────────────────────

    const emit = useCallback((event: string, data: any) => {
        if (!socketRef.current?.connected) {
            console.warn("[WebSocket] Cannot emit: not connected");
            return;
        }
        socketRef.current.emit(event, data);
    }, []);

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (config.autoConnect !== false) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [connect, disconnect, config.autoConnect]);

    // ─── Return ───────────────────────────────────────────────────────────────

    return {
        ...state,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        on,
        off,
        emit,
        socket: socketRef.current,
    };
}
