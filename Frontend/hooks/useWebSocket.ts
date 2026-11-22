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
    const subscriptionRetryTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const reconnectAttemptsRef = useRef(0);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const subscribedMarketsRef = useRef<Set<string>>(new Set());
    const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

    const maxReconnectAttempts = config.reconnectionAttempts ?? 5;
    const reconnectionDelay = config.reconnectionDelay ?? 1000;
    const pollingInterval = config.pollingInterval ?? 30000;
    const url = config.url;
    const namespace = config.namespace;
    const authToken = config.auth?.token;
    const autoConnect = config.autoConnect;
    const fallbackToPolling = config.fallbackToPolling;

    const startPollingFallback = useCallback(() => {
        console.log("[WebSocket] Starting polling fallback");

        pollingIntervalRef.current = setInterval(() => {
            const markets = Array.from(subscribedMarketsRef.current);
            if (markets.length > 0) {
                const pollingListeners = listenersRef.current.get("polling");
                pollingListeners?.forEach((listener) => listener({ marketIds: markets }));
            }
        }, pollingInterval);
    }, [pollingInterval]);

    const emitSubscriptions = useCallback((socket: Socket, marketIds: string[], attempt = 0) => {
        const activeMarketIds = marketIds.filter((id) => subscribedMarketsRef.current.has(id));
        if (activeMarketIds.length === 0 || !socket.connected) return;

        socket.timeout(reconnectionDelay).emit(
            "subscribe",
            { marketIds: activeMarketIds },
            (timeoutError: Error | null, response: any) => {
                const error = timeoutError || (response?.error ? new Error(String(response.error)) : null);
                if (error) {
                    setState((prev) => ({ ...prev, status: "error", error, isConnected: socket.connected }));
                    if (fallbackToPolling && !pollingIntervalRef.current) {
                        startPollingFallback();
                    }
                    if (attempt < maxReconnectAttempts) {
                        const retryTimeout = setTimeout(() => {
                            subscriptionRetryTimeoutsRef.current.delete(retryTimeout);
                            emitSubscriptions(socket, activeMarketIds, attempt + 1);
                        }, reconnectionDelay * 2 ** attempt);
                        subscriptionRetryTimeoutsRef.current.add(retryTimeout);
                    }
                    return;
                }

                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
                setState((prev) => ({
                    ...prev,
                    status: socket.connected ? "connected" : "disconnected",
                    error: null,
                    isConnected: socket.connected,
                }));
            },
        );
    }, [fallbackToPolling, maxReconnectAttempts, reconnectionDelay, startPollingFallback]);

    // ─── Connect ──────────────────────────────────────────────────────────────

    const connect = useCallback(() => {
        if (socketRef.current) {
            if (socketRef.current.connected) {
                emitSubscriptions(socketRef.current, Array.from(subscribedMarketsRef.current));
                return;
            }

            setState((prev) => ({ ...prev, status: "connecting", error: null }));
            socketRef.current.connect();
            return;
        }

        setState((prev) => ({ ...prev, status: "connecting", error: null }));

        try {
            const socketUrl = `${url}${namespace || ""}`;
            const socket = io(socketUrl, {
                auth: authToken ? { token: authToken } : {},
                autoConnect: autoConnect ?? true,
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
                    emitSubscriptions(socket, Array.from(subscribedMarketsRef.current));
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
                if (fallbackToPolling && !pollingIntervalRef.current) {
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
                    if (fallbackToPolling) {
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
            if (autoConnect === false) {
                socket.connect();
            }
        } catch (error) {
            console.error("[WebSocket] Failed to create socket:", error);
            setState({
                status: "error",
                error: error as Error,
                isConnected: false,
                lastUpdate: null,
            });
        }
    }, [url, namespace, authToken, autoConnect, fallbackToPolling, maxReconnectAttempts, reconnectionDelay, emitSubscriptions, startPollingFallback]);

    // ─── Disconnect ───────────────────────────────────────────────────────────

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        subscriptionRetryTimeoutsRef.current.forEach(clearTimeout);
        subscriptionRetryTimeoutsRef.current.clear();

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

    // ─── Subscribe to Markets ─────────────────────────────────────────────────

    const subscribe = useCallback((marketIds: string[]) => {
        marketIds.forEach((id) => subscribedMarketsRef.current.add(id));

        if (!socketRef.current?.connected) {
            console.warn("[WebSocket] Cannot subscribe: not connected");
            return;
        }

        emitSubscriptions(socketRef.current, marketIds);
    }, [emitSubscriptions]);

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
        if (autoConnect !== false) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [connect, disconnect, autoConnect]);

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
