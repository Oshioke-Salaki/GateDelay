"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { useConnectKitBridge } from "@/app/components/ConnectKitBridgeContext";
import TradingInterface, { Market } from "@/app/components/trade/TradingInterface";
import { fetchMarketById } from "@/lib/marketApi";

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; market: Market }
  | { status: "not-found" }
  | { status: "unavailable"; market: Market }
  | { status: "error"; message: string };

const UNAVAILABLE_STATUSES = new Set(["closed", "resolved", "disputed"]);

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  return (
    candidate.status === 404 ||
    candidate.statusCode === 404 ||
    candidate.response?.status === 404
  );
}

export default function TradePage({ params }: { params: { id: string } }) {
  const { address } = useConnectKitBridge();
  const marketId = params.id;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetchMarketById(marketId)
      .then((market) => {
        if (cancelled) return;
        if (!market) {
          setState({ status: "not-found" });
          return;
        }
        if (UNAVAILABLE_STATUSES.has(String(market.status).toLowerCase())) {
          setState({ status: "unavailable", market });
          return;
        }
        setState({ status: "loaded", market });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setState({ status: "not-found" });
          return;
        }
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load market",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [marketId, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (state.status === "loading") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Loading market
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Fetching market <code className="font-mono">{marketId}</code>…
        </p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Market not found
        </h1>
        <p style={{ color: "var(--muted)" }}>
          No market exists for <code className="font-mono">{marketId}</code>.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Back to Markets
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === "unavailable") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Market unavailable
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Market <code className="font-mono">{marketId}</code> is{" "}
          <strong>{state.market.status}</strong> and is no longer open for
          trading.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Back to Markets
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Could not load market
        </h1>
        <p style={{ color: "var(--muted)" }}>{state.message}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={retry}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#3b82f6" }}
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Back to Markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PageErrorBoundary>
      <TradingInterface market={state.market} userAddress={address} />
    </PageErrorBoundary>
  );
}
