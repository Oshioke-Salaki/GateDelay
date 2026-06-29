"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2, Clock, Smartphone, Monitor, RotateCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = "synced" | "syncing" | "pending" | "conflict" | "offline" | "error";

export interface SyncDevice {
    id: string;
    name: string;
    type: "mobile" | "desktop" | "tablet";
    lastSync: number;
    online: boolean;
}

export interface SyncConflict {
    id: string;
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    timestamp: number;
}

export interface SyncEventData {
    type: "sync_complete" | "sync_error" | "conflict_detected" | "sync_started";
    data?: unknown;
    timestamp: number;
}

export interface CrossDeviceSyncProps {
    onSyncComplete?: () => void;
    onConflictResolve?: (conflicts: SyncConflict[]) => void;
    autoSync?: boolean;
    syncInterval?: number;
}

// ─── Sync Store ───────────────────────────────────────────────────────────────

class SyncStore {
    private listeners = new Set<(state: SyncStoreState) => void>();
    private state: SyncStoreState = {
        status: "synced",
        devices: [],
        conflicts: [],
        lastSyncTime: null,
        pendingOperations: 0,
    };

    getState() {
        return this.state;
    }

    setState(newState: Partial<SyncStoreState>) {
        this.state = { ...this.state, ...newState };
        this.listeners.forEach((l) => l(this.state));
    }

    subscribe(listener: (state: SyncStoreState) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

interface SyncStoreState {
    status: SyncStatus;
    devices: SyncDevice[];
    conflicts: SyncConflict[];
    lastSyncTime: number | null;
    pendingOperations: number;
}

const syncStore = new SyncStore();

// ─── Mock Storage for Demo ────────────────────────────────────────────────────

const SYNC_STORAGE_KEY = "gate_delay_sync_queue";
const DEVICE_STORAGE_KEY = "gate_delay_synced_devices";

function getStoredQueue(): unknown[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(SYNC_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function setStoredQueue(queue: unknown[]) {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(queue));
}

function getStoredDevices(): SyncDevice[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function setStoredDevices(devices: SyncDevice[]) {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(devices));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useSyncState() {
    const [state, setState] = useState<SyncStoreState>(syncStore.getState());

    useEffect(() => {
        return syncStore.subscribe((newState) => setState(newState));
    }, []);

    return state;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CrossDeviceSync({
    onSyncComplete,
    onConflictResolve,
    autoSync = false,
    syncInterval = 30000,
}: CrossDeviceSyncProps) {
    const { isConnected } = useAccount();
    const [syncState] = useSyncState();
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const isOnline = typeof window !== "undefined" ? navigator.onLine : true;

    useEffect(() => {
        if (autoSync && isConnected && isOnline) {
            syncStore.setState({ status: "syncing" });
            processSync();

            syncIntervalRef.current = setInterval(processSync, syncInterval);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [autoSync, isConnected, isOnline, syncInterval]);

    useEffect(() => {
        const handleOnline = () => {
            syncStore.setState({ status: "syncing" });
            processSync();
        };

        const handleOffline = () => {
            syncStore.setState({ status: "offline" });
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const processSync = useCallback(async () => {
        if (!isConnected || !isOnline) return;

        const queue = getStoredQueue();
        const pendingCount = queue.length;

        syncStore.setState({ pendingOperations: pendingCount });

        if (pendingCount === 0) {
            syncStore.setState({
                status: "synced",
                lastSyncTime: Date.now(),
            });
            onSyncComplete?.();
            return;
        }

        syncStore.setState({ status: "syncing" });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (queue.length > 0) {
            const conflicts: SyncConflict[] = queue
                .filter((_: unknown, index: number) => index % 3 === 0)
                .map((op: unknown, index: number) => ({
                    id: `conflict-${Date.now()}-${index}`,
                    field: "position",
                    localValue: (op as Record<string, unknown>).local,
                    remoteValue: (op as Record<string, unknown>).remote,
                    timestamp: Date.now(),
                }));

            if (conflicts.length > 0) {
                syncStore.setState({ status: "conflict", conflicts });
                return;
            }
        }

        setStoredQueue([]);
        syncStore.setState({
            status: "synced",
            lastSyncTime: Date.now(),
            pendingOperations: 0,
        });
        onSyncComplete?.();
    }, [isConnected, isOnline, onSyncComplete]);

    const handleManualSync = useCallback(() => {
        processSync();
    }, [processSync]);

    const handleResolveConflict = useCallback(
        (conflictId: string, resolution: "local" | "remote") => {
            const updatedConflicts = syncStore.getState().conflicts.filter((c) => c.id !== conflictId);
            setStoredQueue([]);
            syncStore.setState({
                status: "synced",
                conflicts: updatedConflicts,
                lastSyncTime: Date.now(),
                pendingOperations: 0,
            });
            onConflictResolve?.([syncStore.getState().conflicts.find((c) => c.id === conflictId)].filter(Boolean) as SyncConflict[]);
        },
        [onConflictResolve]
    );

    const getDeviceIcon = (type: SyncDevice["type"]) => {
        switch (type) {
            case "mobile":
                return Smartphone;
            case "desktop":
            default:
                return Monitor;
        }
    };

    const getRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return "now";
    };

    const devices = getStoredDevices();

    return (
        <div
            className="rounded-3xl p-5 shadow-2xl"
            style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
            }}
        >
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2 bg-blue-500/10">
                        <RefreshCw size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="font-bold">Cross-Device Sync</h3>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Sync your data across devices
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isOnline ? (
                        <Wifi size={16} className="text-green-500" />
                    ) : (
                        <WifiOff size={16} className="text-red-500" />
                    )}
                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        {isOnline ? "Online" : "Offline"}
                    </span>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl p-3" style={{ background: "var(--background)" }}>
                <div>
                    <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                        Sync Status
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                        {syncState.status === "synced" && <CheckCircle2 size={16} className="text-emerald-500" />}
                        {syncState.status === "syncing" && <RotateCw size={16} className="animate-spin text-blue-500" />}
                        {syncState.status === "pending" && <Clock size={16} className="text-amber-500" />}
                        {syncState.status === "conflict" && <AlertTriangle size={16} className="text-amber-500" />}
                        {syncState.status === "offline" && <WifiOff size={16} className="text-red-500" />}
                        {syncState.status === "error" && <AlertTriangle size={16} className="text-red-500" />}
                        <span className="font-semibold capitalize">{syncState.status}</span>
                    </div>
                </div>
                {syncState.lastSyncTime && (
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                            Last Sync
                        </p>
                        <p className="mt-1 text-sm">{getRelativeTime(syncState.lastSyncTime)}</p>
                    </div>
                )}
            </div>

            {syncState.pendingOperations > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-300/50 bg-amber-50 p-3" style={{ borderColor: "#fde68a" }}>
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-amber-600" />
                        <p className="text-sm font-semibold text-amber-800">Pending Operations</p>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "#92400e" }}>
                        {syncState.pendingOperations} pending sync operations in queue
                    </p>
                </div>
            )}

            {devices.length > 0 && (
                <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                        Synced Devices
                    </p>
                    <div className="space-y-2">
                        {devices.map((device) => {
                            const Icon = getDeviceIcon(device.type);
                            return (
                                <div
                                    key={device.id}
                                    className="flex items-center justify-between rounded-xl p-2.5 text-sm"
                                    style={{ background: "var(--background)" }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon size={14} style={{ color: "var(--muted)" }} />
                                        <span>{device.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                                            {getRelativeTime(device.lastSync)}
                                        </span>
                                        <div
                                            className={`h-2 w-2 rounded-full ${
                                                device.online ? "bg-green-500" : "bg-zinc-400"
                                            }`}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {syncState.conflicts.length > 0 && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden"
                    >
                        <div
                            className="rounded-2xl border border-amber-300/50 p-4"
                            style={{
                                background: "var(--background)",
                                borderColor: "#fde68a",
                            }}
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-amber-600" />
                                <p className="font-semibold">Sync Conflicts ({syncState.conflicts.length})</p>
                            </div>

                            <div className="space-y-3">
                                {syncState.conflicts.map((conflict) => (
                                    <div key={conflict.id} className="rounded-xl p-3 text-xs" style={{ background: "var(--card)" }}>
                                        <p className="font-semibold">Field: {conflict.field}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-zinc-500">Local</p>
                                                <p className="font-mono">
                                                    {typeof conflict.localValue === "object"
                                                        ? JSON.stringify(conflict.localValue)
                                                        : String(conflict.localValue)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500">Remote</p>
                                                <p className="font-mono">
                                                    {typeof conflict.remoteValue === "object"
                                                        ? JSON.stringify(conflict.remoteValue)
                                                        : String(conflict.remoteValue)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                onClick={() => handleResolveConflict(conflict.id, "local")}
                                                className="flex-1 rounded-lg bg-blue-500 px-2 py-1 text-xs font-semibold text-white"
                                            >
                                                Use Local
                                            </button>
                                            <button
                                                onClick={() => handleResolveConflict(conflict.id, "remote")}
                                                className="flex-1 rounded-lg bg-zinc-300 px-2 py-1 text-xs font-semibold dark:bg-zinc-700"
                                            >
                                                Use Remote
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            <button
                onClick={handleManualSync}
                disabled={!isConnected || !isOnline || syncState.status === "syncing"}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: "#6366f1" }}
            >
                {syncState.status === "syncing" ? (
                    <>
                        <RotateCw size={16} className="animate-spin" />
                        Syncing...
                    </>
                ) : (
                    <>
                        <RefreshCw size={16} />
                        Sync Now
                    </>
                )}
            </button>

            {!isConnected && (
                <p className="mt-2 text-center text-xs" style={{ color: "var(--muted)" }}>
                    Connect wallet to enable sync
                </p>
            )}
        </div>
    );
}