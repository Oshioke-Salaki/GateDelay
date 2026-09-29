"use client";

import { useEffect, useState, useRef } from "react";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How old (in ms) a price timestamp must be before we consider it stale.
 * 30 s aligns with the REST polling fallback interval so a price can only
 * genuinely age beyond this when the fallback itself has also failed.
 */
export const STALE_PRICE_THRESHOLD_MS = 30_000;

/** Re-evaluate staleness every second. */
const TICK_INTERVAL_MS = 1_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StalePriceInfo {
  /** True when the most recent known price is older than the threshold. */
  isStale: boolean;
  /**
   * Seconds since the last price update, or null when no price has ever
   * arrived for this market.
   */
  ageSeconds: number | null;
  /** The raw ms timestamp of the last known price, or null. */
  lastTimestamp: number | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns staleness metadata for a single market's live price.
 *
 * The check runs on a 1-second interval so the `ageSeconds` value stays
 * current without requiring a new price event. The hook is deliberately
 * lightweight: it reads from the shared WebSocket context rather than
 * creating its own subscription.
 */
export function useStalePriceDetection(
  marketId: string,
  thresholdMs: number = STALE_PRICE_THRESHOLD_MS,
): StalePriceInfo {
  const { getPrice, isConnected } = useWebSocketContext();
  const [info, setInfo] = useState<StalePriceInfo>({
    isStale: false,
    ageSeconds: null,
    lastTimestamp: null,
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function evaluate() {
      const priceUpdate = getPrice(marketId);

      if (!priceUpdate) {
        // No data ever received — treat as stale only if we're connected
        // (if we're not connected the websocket itself handles the warning).
        setInfo({
          isStale: isConnected,
          ageSeconds: null,
          lastTimestamp: null,
        });
        return;
      }

      const ageMs = Date.now() - priceUpdate.timestamp;
      const ageSeconds = Math.floor(ageMs / 1000);

      setInfo({
        isStale: ageMs > thresholdMs,
        ageSeconds,
        lastTimestamp: priceUpdate.timestamp,
      });
    }

    evaluate(); // run immediately on mount / dep change

    tickRef.current = setInterval(evaluate, TICK_INTERVAL_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [marketId, thresholdMs, getPrice, isConnected]);

  return info;
}
