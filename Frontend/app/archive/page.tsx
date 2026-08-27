"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Archive, RefreshCw } from "lucide-react";
import ArchiveView from "../../components/archive/ArchiveView";
import { MarketListSkeleton } from "../components/ui/Skeleton";
import { isArchivedMarket, type ArchivedMarket } from "../../components/archive/types";

/**
 * Market archive route (`/archive`).
 *
 * ## Hydration
 *
 * Data is fetched in an effect, never during render. The first paint is
 * identical on the server and the client — the skeleton — so there is nothing
 * for React to reconcile on hydration. Reading the fetch result during render,
 * or seeding state from anything time- or environment-dependent (`Date.now()`,
 * `window`, `Math.random()`), would produce a server/client mismatch and the
 * "text content did not match" warning.
 *
 * ## No blank screens
 *
 * Every terminal state is rendered explicitly: `loading`, `error` (with the
 * reason and a retry), `empty`, and `ready`. The page previously held a static
 * mock array with `isLoading` pinned to `false`, so a real failure had nowhere
 * to surface.
 */

// Re-exported for backwards compatibility: `ArchivedMarket` used to be declared
// here and is imported from this path elsewhere. The declaration now lives in
// components/archive/types.ts.
export type { ArchivedMarket };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; markets: ArchivedMarket[] };

async function fetchArchivedMarkets(signal: AbortSignal): Promise<ArchivedMarket[]> {
  const res = await fetch("/api/archive?limit=500", { signal });

  if (!res.ok) {
    // The proxy answers with { error } for both config and upstream faults.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Request failed with status ${res.status}`);
  }

  const payload: unknown = await res.json();
  const rows = Array.isArray(payload)
    ? payload
    : (payload as { data?: unknown })?.data;

  if (!Array.isArray(rows)) {
    throw new Error("The archive endpoint returned an unexpected response shape.");
  }

  // Drop anything malformed rather than letting ArchiveView crash on
  // `market.title.toLowerCase()` partway down the list.
  return rows.filter(isArchivedMarket);
}

export default function ArchivePage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchArchivedMarkets(controller.signal)
      .then((markets) => setState({ status: "ready", markets }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the market archive.",
        });
      });

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl p-2.5 shrink-0" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <Archive size={20} style={{ color: "var(--foreground)" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            Market Archive
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Browse resolved and inactive markets with performance statistics
          </p>
        </div>
      </div>

      {state.status === "loading" && (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading archived markets…</span>
          <MarketListSkeleton count={5} />
        </div>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <AlertTriangle size={20} className="shrink-0" style={{ color: "#ef4444" }} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold" style={{ color: "var(--foreground)" }}>
              Could not load the market archive
            </p>
            <p className="text-sm mt-1 break-words" style={{ color: "var(--muted)" }}>
              {state.message}
            </p>
          </div>
          <button
            onClick={retry}
            className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      {state.status === "ready" && state.markets.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="font-semibold" style={{ color: "var(--foreground)" }}>
            No resolved markets yet
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Markets appear here once they have been resolved or cancelled.
          </p>
        </div>
      )}

      {state.status === "ready" && state.markets.length > 0 && (
        <ArchiveView markets={state.markets} />
      )}
    </main>
  );
}
