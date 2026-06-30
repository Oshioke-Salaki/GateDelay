"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Measurement interval in milliseconds (every 10 s). */
const MEASURE_INTERVAL_MS = 10_000;

/** Minimum number of samples before status is considered stable. */
const MIN_SAMPLES = 3;

/** Rolling-window size for the moving average. */
const WINDOW_SIZE = 5;

/** Debounce (ms) before status label changes are committed to state. */
const STATUS_DEBOUNCE_MS = 2_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type LatencyStatus = "excellent" | "fair" | "poor" | "unknown";

export interface LatencyState {
  /** Latest measured RTT in milliseconds, or null while measuring. */
  latencyMs: number | null;
  /** Smoothed moving-average RTT. */
  averageMs: number | null;
  /** Categorical status based on thresholds. */
  status: LatencyStatus;
  /** True while an active probe is in-flight. */
  measuring: boolean;
  /** ISO timestamp of the last successful measurement. */
  lastMeasuredAt: string | null;
  /** Number of completed measurements in this session. */
  sampleCount: number;
  /** Manually trigger an immediate measurement. */
  measure: () => void;
}

// ─── Threshold helpers ────────────────────────────────────────────────────────

/**
 * Classify a raw RTT reading into a status category.
 * Excellent: ≤ 100 ms  |  Fair: 101–300 ms  |  Poor: > 300 ms
 */
export function classifyLatency(ms: number): LatencyStatus {
  if (ms <= 100) return "excellent";
  if (ms <= 300) return "fair";
  return "poor";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * `useLatency` continuously probes the network round-trip time by firing a
 * small HEAD request (or using the Resource Timing API entry if available) and
 * calculates a debounced, smoothed status for the UI.
 *
 * @param probeUrl  URL to probe. Defaults to `"/api/ping"`.  Any fast,
 *                  cacheless endpoint works – the response body is ignored.
 */
export function useLatency(probeUrl = "/api/ping"): LatencyState {
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [averageMs, setAverageMs] = useState<number | null>(null);
  const [status, setStatus] = useState<LatencyStatus>("unknown");
  const [measuring, setMeasuring] = useState(false);
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState(0);

  // Rolling window of recent RTT samples
  const samplesRef = useRef<number[]>([]);
  // Timer refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the pending status to debounce it
  const pendingStatusRef = useRef<LatencyStatus>("unknown");

  // ── Core measurement ──────────────────────────────────────────────────────

  const measure = useCallback(async () => {
    setMeasuring(true);

    const t0 = performance.now();
    const cacheKey = `_nc=${t0}`;
    const url = probeUrl.includes("?")
      ? `${probeUrl}&${cacheKey}`
      : `${probeUrl}?${cacheKey}`;

    try {
      await fetch(url, {
        method: "HEAD",
        cache: "no-store",
        // Suppress auth headers / cookies so the probe is as light as possible
        credentials: "omit",
      });

      const t1 = performance.now();
      let rtt = Math.round(t1 - t0);

      // If the browser supports Resource Timing, prefer that measurement
      // because it excludes JS overhead and is more accurate.
      try {
        const entries = performance.getEntriesByName(url, "resource");
        const latest = entries[entries.length - 1] as PerformanceResourceTiming | undefined;
        if (latest && latest.responseEnd > 0 && latest.startTime > 0) {
          rtt = Math.round(latest.responseEnd - latest.startTime);
        }
      } catch {
        // Resource Timing not supported – use the JS measurement
      }

      // Update rolling window
      const samples = [...samplesRef.current, rtt].slice(-WINDOW_SIZE);
      samplesRef.current = samples;

      const avg = Math.round(
        samples.reduce((a, b) => a + b, 0) / samples.length
      );

      setLatencyMs(rtt);
      setAverageMs(avg);
      setLastMeasuredAt(new Date().toISOString());
      setSampleCount((c) => c + 1);

      // Debounce the status so brief jitter doesn't cause UI flicker
      const newStatus = classifyLatency(avg);
      pendingStatusRef.current = newStatus;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setStatus(pendingStatusRef.current);
      }, STATUS_DEBOUNCE_MS);

      // Before we have MIN_SAMPLES, keep status as "unknown"
      if (samples.length >= MIN_SAMPLES) {
        // Status is committed after debounce above
      } else {
        setStatus("unknown");
      }
    } catch {
      // Network error – treat as poor (but only if we have no good signal)
      if (samplesRef.current.length === 0) {
        setStatus("poor");
      }
    } finally {
      setMeasuring(false);
    }
  }, [probeUrl]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Fire immediately on mount
    measure();

    intervalRef.current = setInterval(measure, MEASURE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [measure]);

  return {
    latencyMs,
    averageMs,
    status,
    measuring,
    lastMeasuredAt,
    sampleCount,
    measure,
  };
}
