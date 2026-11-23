"use client";

import { useEffect, useState } from "react";
import type { PricePoint } from "@/components/chart/PriceChart";

/** The configured indexer must return timestamped outcome quotes, never spot asset prices. */
export function usePriceHistory(marketId?: string, suppliedData?: PricePoint[]) {
  const [state, setState] = useState<{ key?: string; data: PricePoint[]; loading: boolean; error: string | null }>({ data: [], loading: false, error: null });
  useEffect(() => {
    if (suppliedData !== undefined) return;
    const controller = new AbortController();
    const endpoint = process.env.NEXT_PUBLIC_OUTCOME_HISTORY_URL;
    if (!marketId || !endpoint) {
      setState({ key: marketId, data: [], loading: false, error: "Historical outcome prices are unavailable." });
      return;
    }
    setState({ key: marketId, data: [], loading: true, error: null });
    void (async () => {
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("marketId", marketId);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Historical outcome prices are unavailable.");
        const rows: unknown = await response.json();
        if (!Array.isArray(rows) || !rows.every((p) => p && Number.isFinite(p.timestamp) && p.timestamp > 0 && [p.yesPrice, p.noPrice].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) && (p.volume === undefined || (Number.isFinite(p.volume) && p.volume >= 0)))) throw new Error("Invalid historical outcome prices.");
        if (!controller.signal.aborted) setState({ key: marketId, data: rows.slice().sort((a, b) => a.timestamp - b.timestamp), loading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key: marketId, data: [], loading: false, error: error instanceof Error ? error.message : "Price history unavailable." });
      }
    })();
    return () => controller.abort();
  }, [marketId, suppliedData]);
  if (suppliedData !== undefined) return { data: suppliedData, loading: false, error: null };
  return state.key === marketId ? state : { data: [], loading: true, error: null };
}
