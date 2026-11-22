"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONNECTIVITY_PROBE_URL,
  MAX_RECONNECT_ATTEMPTS,
  NETWORK_FAILURE_THRESHOLD,
  isConnectivityProbeUrl,
  isNetworkFailureError,
  isNetworkFailureStatus,
  reconnectProgressPercent,
  requestUrl,
  type UnreachableReason,
} from "../lib/connectivity";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConnectivityStatus = "online" | "offline" | "syncing" | "loading";

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
  /**
   * Current high-level connectivity status.
   * `"loading"` is the initial value during SSR / before the browser APIs have
   * been read on the client.  Consumers should treat it the same as `"online"`
   * for rendering purposes and only show loading UI when they need to gate on
   * a confirmed status.
   */
  status: ConnectivityStatus;
  /**
   * True when the browser is offline *or* the backend cannot be reached.
   * Always `false` during the `"loading"` phase so consumers can safely render
   * without a flash of offline UI on first paint.
   */
  isOffline: boolean;
  /**
   * True while the browser is online but the backend probe is failing and we
   * are actively retrying `/api/ping`. Distinct from `isSyncing`, which is the
   * offline-action queue drain.
   */
  isReconnecting: boolean;
  /** Why connectivity is currently unavailable, or `null` when healthy. */
  unreachableReason: UnreachableReason | null;
  /** 1-based reconnect probe attempt, `0` when not reconnecting. */
  reconnectAttempt: number;
  /** 0–95 progress toward a successful probe (never 100 until restored). */
  reconnectProgress: number;
  /** True while the sync pass is running */
  isSyncing: boolean;
  /**
   * Report a failed application request. Multiple callers collapse into one
   * connectivity state — they do not create extra banners.
   */
  reportRequestFailure: () => void;
  /**
   * True during the initial SSR / hydration window before browser connectivity
   * APIs have been queried.  Use this to suppress connectivity-dependent UI
   * until the real status is known.
   */
  isLoading: boolean;
  /**
   * True once the hook has read `navigator.onLine` and the offline queue from
   * `localStorage` on the client.  Equivalent to `!isLoading`.
   */
  isReady: boolean;
  /** Snapshot of actions waiting to be synced */
  queue: QueuedAction[];
  /**
   * True when `queue` is empty.  Convenience flag that avoids `queue.length === 0`
   * checks in render code.
   */
  hasNoQueue: boolean;
  /** Add an action to the persistent queue */
  enqueue: (label: string, payload: unknown) => string;
  /** Remove a specific action from the queue by id */
  dequeue: (id: string) => void;
  /** Manually trigger a sync pass (no-op when offline or loading) */
  syncNow: () => Promise<void>;
  /** Register a handler that will be called for each queued action on reconnect */
  registerSyncHandler: (handler: SyncHandler) => () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gd_offline_queue";
const MAX_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 3_000;

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
 *  - `navigator.onLine` (initial value, read after hydration)
 *  - window `online` / `offline` events (instant change detection)
 *  - Network Information API `change` events (degraded connection awareness)
 *
 * Actions queued while offline are persisted to localStorage and automatically
 * retried when connectivity is restored.
 *
 * ## Loading / Empty States
 *
 * On the server (SSR) and during the React hydration window, the browser APIs
 * (`navigator`, `localStorage`) are unavailable or unsafe to read.  The hook
 * therefore starts with `isLoading: true` / `status: "loading"` and resolves
 * to the real connectivity status in a `useEffect` once the component has
 * mounted on the client.
 *
 * Consumers should:
 *  - Gate connectivity-dependent UI on `isReady` (or check `!isLoading`)
 *  - Use `hasNoQueue` instead of `queue.length === 0` for empty-state rendering
 *  - Treat `status === "loading"` the same as `"online"` for optimistic renders
 */
export function useConnectivity(): ConnectivityState {
  // ── isLoading / isReady ───────────────────────────────────────────────────
  // Start as `true` on both server and client; flipped to `false` in the first
  // useEffect so the first client render never diverges from the SSR render.
  const [isLoading, setIsLoading] = useState(true);

  // ── Online state ──────────────────────────────────────────────────────────
  // Default to `true` (optimistic) so SSR HTML matches the most common case.
  // The real navigator.onLine value is read inside useEffect below.
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [backendReachable, setBackendReachable] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const failureCountRef = useRef(0);

  // ── Queue ─────────────────────────────────────────────────────────────────
  // Start empty on both server and client; populated from localStorage inside
  // useEffect to avoid SSR/client hydration mismatch.
  const [queue, setQueue] = useState<QueuedAction[]>([]);

  // Handlers registered by consumers (stable refs via a Set)
  const handlersRef = useRef<Set<SyncHandler>>(new Set());

  // ── Bootstrap on client mount ──────────────────────────────────────────────
  // Runs once after hydration to read the real navigator.onLine and the
  // persisted queue from localStorage.  Setting isLoading to false here (after
  // the first paint) prevents an SSR/client HTML mismatch.
  useEffect(() => {
    const realOnline = navigator.onLine && !isConnectionDegraded();
    setIsOnline(realOnline);
    setQueue(loadQueue());
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status derivation ──────────────────────────────────────────────────────
  const markBackendUnreachable = useCallback(() => {
    setBackendReachable(false);
  }, []);

  const reportRequestFailure = useCallback(() => {
    failureCountRef.current += 1;
    if (failureCountRef.current >= NETWORK_FAILURE_THRESHOLD) {
      markBackendUnreachable();
    }
  }, [markBackendUnreachable]);

  const probeBackend = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !navigator.onLine) return false;
    const cacheKey = `_nc=${Date.now()}`;
    const url = `${CONNECTIVITY_PROBE_URL}?${cacheKey}`;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
      });
      if (res.ok) {
        failureCountRef.current = 0;
        setBackendReachable(true);
        setReconnectAttempt(0);
        return true;
      }
      markBackendUnreachable();
      return false;
    } catch (error) {
      if (isNetworkFailureError(error) || error instanceof Error) {
        markBackendUnreachable();
      }
      return false;
    }
  }, [markBackendUnreachable]);

  const status: ConnectivityStatus = isLoading
    ? "loading"
    : isSyncing
    ? "syncing"
    : isOnline && backendReachable
    ? "online"
    : "offline";

  const isReconnecting =
    !isLoading && isOnline && !backendReachable;

  const unreachableReason: UnreachableReason | null = isLoading
    ? null
    : !isOnline
    ? "browser"
    : !backendReachable
    ? "backend"
    : null;

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
    // No-op while loading (navigator not yet queried) or offline
    if (isLoading || !navigator.onLine) return;
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
  }, [isLoading]);

  // ── Event listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Browser connectivity is back; backend health is still unknown until probe.
      void probeBackend();
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
  }, [syncNow, probeBackend]);

  // ── Backend probe + reconnect loop ─────────────────────────────────────────
  // Recovery is owned by this probe. A stray successful application request
  // must not clear an unreachable state while the probe is still failing.

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;
    if (!isOnline) {
      setReconnectAttempt(0);
      return;
    }

    if (backendReachable) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      setReconnectAttempt((prev) =>
        prev >= MAX_RECONNECT_ATTEMPTS ? 1 : prev + 1,
      );
      await probeBackend();
    };

    void tick();
    const id = window.setInterval(tick, RECONNECT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLoading, isOnline, backendReachable, probeBackend]);

  // Collapse duplicate failed fetches into a single connectivity state.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      try {
        const res = await originalFetch(input, init);
        if (!isConnectivityProbeUrl(url) && isNetworkFailureStatus(res.status)) {
          reportRequestFailure();
        }
        return res;
      } catch (error) {
        if (!isConnectivityProbeUrl(url) && isNetworkFailureError(error)) {
          reportRequestFailure();
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [reportRequestFailure]);

  // ── Handler registration ───────────────────────────────────────────────────

  const registerSyncHandler = useCallback((handler: SyncHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return {
    status,
    // isOffline is always false while loading to prevent flash of offline UI
    isOffline: !isLoading && (!isOnline || !backendReachable),
    isReconnecting,
    unreachableReason,
    reconnectAttempt: isReconnecting ? reconnectAttempt : 0,
    reconnectProgress: isReconnecting
      ? reconnectProgressPercent(reconnectAttempt)
      : 0,
    isSyncing,
    isLoading,
    isReady: !isLoading,
    queue,
    // Convenience flag: true when there are no pending queued actions
    hasNoQueue: queue.length === 0,
    enqueue,
    dequeue,
    syncNow,
    registerSyncHandler,
    reportRequestFailure,
  };
}
