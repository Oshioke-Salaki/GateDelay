"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConnectivityStatus = "online" | "offline" | "syncing";

export interface QueuedAction {
  /** Unique identifier for deduplication */
  id: string;
  /** Arbitrary label to describe the action */
  label: string;
  /** ISO timestamp when the action was queued */
  queuedAt: string;
  /** Serialisable payload – application-defined */
  payload: unknown;
  /** Number of sync attempts so far */
  attempts: number;
}

export type SyncHandler = (action: QueuedAction) => Promise<void>;

export interface ConnectivityState {
  /** Current high-level connectivity status */
  status: ConnectivityStatus;
  /** True when navigator.onLine is false */
  isOffline: boolean;
  /** True while the sync pass is running */
  isSyncing: boolean;
  /** Snapshot of actions waiting to be synced */
  queue: QueuedAction[];
  /** Add an action to the persistent queue */
  enqueue: (label: string, payload: unknown) => string;
  /** Remove a specific action from the queue by id */
  dequeue: (id: string) => void;
  /** Manually trigger a sync pass (no-op when offline) */
  syncNow: () => Promise<void>;
  /** Register a handler that will be called for each queued action on reconnect */
  registerSyncHandler: (handler: SyncHandler) => () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gd_offline_queue";
const MAX_ATTEMPTS = 5;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage quota exceeded – silently skip persistence
  }
}

// ─── Network Information API helpers ──────────────────────────────────────────

/**
 * Returns true if the Network Information API reports the connection as
 * effectively offline (save-data mode or a "none" effective type).
 */
function isConnectionDegraded(): boolean {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return false;
  return conn.effectiveType === "none" || conn.saveData === true;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useConnectivity
 *
 * Monitors browser connectivity using:
 *  - `navigator.onLine` (initial value)
 *  - window `online` / `offline` events (instant change detection)
 *  - Network Information API `change` events (degraded connection awareness)
 *
 * Actions queued while offline are persisted to localStorage and automatically
 * retried when connectivity is restored.
 */
export function useConnectivity(): ConnectivityState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine && !isConnectionDegraded();
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [queue, setQueue] = useState<QueuedAction[]>(() => loadQueue());

  // Handlers registered by consumers (stable refs via a Set)
  const handlersRef = useRef<Set<SyncHandler>>(new Set());

  // ── Status derivation ──────────────────────────────────────────────────────
  const status: ConnectivityStatus = isSyncing
    ? "syncing"
    : isOnline
    ? "online"
    : "offline";

  // ── Queue helpers ──────────────────────────────────────────────────────────

  /** Persist to localStorage whenever the queue changes */
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const enqueue = useCallback((label: string, payload: unknown): string => {
    const id = generateId();
    const action: QueuedAction = {
      id,
      label,
      queuedAt: new Date().toISOString(),
      payload,
      attempts: 0,
    };
    setQueue((prev) => {
      const next = [...prev, action];
      saveQueue(next);
      return next;
    });
    return id;
  }, []);

  const dequeue = useCallback((id: string) => {
    setQueue((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveQueue(next);
      return next;
    });
  }, []);

  // ── Sync logic ─────────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    const currentQueue = loadQueue();
    if (currentQueue.length === 0) return;

    setIsSyncing(true);
    const handlers = Array.from(handlersRef.current);
    const remaining: QueuedAction[] = [];

    for (const action of currentQueue) {
      if (action.attempts >= MAX_ATTEMPTS) {
        // Drop permanently-failing actions
        continue;
      }
      let succeeded = false;
      for (const handler of handlers) {
        try {
          await handler(action);
          succeeded = true;
        } catch {
          // individual handler failure – will retry
        }
      }
      if (!succeeded && handlers.length > 0) {
        remaining.push({ ...action, attempts: action.attempts + 1 });
      }
      // If no handlers are registered we still drain the queue (actions are
      // treated as acknowledged once connectivity returns)
    }

    setQueue(remaining);
    saveQueue(remaining);
    setIsSyncing(false);
  }, []);

  // ── Event listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Fire-and-forget sync – errors are swallowed inside syncNow
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Network Information API (Chrome / Android WebView)
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (conn) {
      const handleConnectionChange = () => {
        const degraded = isConnectionDegraded();
        setIsOnline(navigator.onLine && !degraded);
      };
      conn.addEventListener("change", handleConnectionChange);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        conn.removeEventListener("change", handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  // ── Handler registration ───────────────────────────────────────────────────

  const registerSyncHandler = useCallback((handler: SyncHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return {
    status,
    isOffline: !isOnline,
    isSyncing,
    queue,
    enqueue,
    dequeue,
    syncNow,
    registerSyncHandler,
  };
}
