"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookCompactProps {
  marketId: string;
  userAddress?: string;
}

// ─── Order Book Compact ───────────────────────────────────────────────────────

export default function OrderBookCompact({
  marketId,
  userAddress: _userAddress,
}: OrderBookCompactProps) {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);
  const [view, setView] = useState<"all" | "bids" | "asks">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const mockBids: Order[] = [
      { price: 0.995, quantity: 1250, total: 1243.75 },
      { price: 0.9945, quantity: 850, total: 845.33 },
      { price: 0.994, quantity: 2100, total: 2087.4 },
      { price: 0.9935, quantity: 500, total: 496.75 },
      { price: 0.993, quantity: 1800, total: 1787.4 },
    ];
    const mockAsks: Order[] = [
      { price: 1.005, quantity: 900, total: 904.5 },
      { price: 1.0055, quantity: 1500, total: 1508.25 },
      { price: 1.006, quantity: 750, total: 754.5 },
      { price: 1.0065, quantity: 1200, total: 1207.8 },
      { price: 1.007, quantity: 600, total: 604.2 },
    ];
    const id = window.setTimeout(() => {
      setBids(mockBids);
      setAsks(mockAsks);
      setIsLoading(false);
    }, 350);
    return () => window.clearTimeout(id);
  }, [marketId]);

  const maxQuantity = Math.max(
    ...bids.map((b) => b.quantity),
    ...asks.map((a) => a.quantity),
  );

  // ─── Row ─────────────────────────────────────────────────────────────────

  const renderOrderRow = (order: Order, isBid: boolean) => (
    <div
      key={order.price}
      className="relative flex items-center py-1.5 px-2 cursor-pointer"
      style={{ minWidth: 0 }}
    >
      {/* Proportional depth bar — right-anchored, behind content */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 transition-all"
        style={{
          width: `${(order.quantity / maxQuantity) * 100}%`,
          background: isBid
            ? "color-mix(in srgb, #22c55e 12%, transparent)"
            : "color-mix(in srgb, #ef4444 12%, transparent)",
        }}
      />

      {/*
       * Three-column grid:
       *   col 1 (price)    – fixed minimum width so it never clips
       *   col 2 (amount)   – same
       *   col 3 (total)    – same
       * `min-w-0` on every cell prevents text from forcing the row wider
       * than its container; `tabular-nums` keeps digits aligned without
       * a fixed character width.
       */}
      <div className="relative z-10 grid w-full gap-x-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <span
          className="font-mono tabular-nums text-xs font-medium truncate"
          style={{ color: isBid ? "#22c55e" : "#ef4444" }}
        >
          ${order.price.toFixed(4)}
        </span>
        <span
          className="font-mono tabular-nums text-xs text-right truncate"
          style={{ color: "var(--foreground)" }}
        >
          {order.quantity.toLocaleString()}
        </span>
        <span
          className="font-mono tabular-nums text-xs text-right truncate"
          style={{ color: "var(--muted)" }}
        >
          ${order.total.toFixed(2)}
        </span>
      </div>
    </div>
  );

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="rounded-lg shadow-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        role="status"
        aria-busy="true"
        aria-label="Loading order book"
      >
        {/* Header skeleton */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="h-6 w-28 rounded animate-pulse"
            style={{ background: "var(--border)" }}
          />
          <div
            className="h-8 w-32 rounded animate-pulse"
            style={{ background: "var(--border)" }}
          />
        </div>

        {/* Column header skeleton */}
        <div
          className="px-2 py-2"
          style={{ background: "var(--background)" }}
        >
          <div
            className="h-4 w-full rounded animate-pulse"
            style={{ background: "var(--border)" }}
          />
        </div>

        {/* Row skeletons */}
        <div className="h-96 space-y-2 overflow-hidden p-2">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="grid gap-x-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <div className="h-5 rounded animate-pulse" style={{ background: "var(--border)" }} />
              <div className="h-5 rounded animate-pulse" style={{ background: "var(--border)" }} />
              <div className="h-5 rounded animate-pulse" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading order book data…</span>
      </div>
    );
  }

  // ─── Spread ───────────────────────────────────────────────────────────────

  const lowestAsk = [...asks].sort((a, b) => a.price - b.price)[0];
  const highestBid = [...bids].sort((a, b) => b.price - a.price)[0];
  const spread =
    lowestAsk && highestBid ? lowestAsk.price - highestBid.price : null;
  const spreadPct =
    spread !== null && highestBid
      ? ((spread / highestBid.price) * 100).toFixed(2)
      : null;

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          Order Book
        </h3>

        {/* View toggle */}
        <div
          className="flex gap-0.5 rounded-lg p-1"
          style={{ background: "var(--background)" }}
          role="group"
          aria-label="Order book view"
        >
          {(["all", "bids", "asks"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize"
              style={{
                background:
                  view === v ? "var(--card)" : "transparent",
                color:
                  view === v
                    ? v === "bids"
                      ? "#22c55e"
                      : v === "asks"
                        ? "#ef4444"
                        : "var(--foreground)"
                    : "var(--muted)",
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,.15)" : "none",
              }}
              aria-pressed={view === v}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/*
       * ── Column headers ──
       * Mirrors the same 3-column grid used in data rows so labels always
       * line up regardless of container width.
       */}
      <div
        className="grid px-2 py-2 gap-x-2 text-xs font-semibold"
        style={{
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          background: "var(--background)",
          color: "var(--muted)",
          borderBottom: "1px solid var(--border)",
        }}
        aria-hidden="true"
      >
        <span>Price (USD)</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* ── Order lists ── */}
      <div className="max-h-96 overflow-y-auto overflow-x-hidden">
        {/* Asks — highest price first (most expensive at top) */}
        {(view === "all" || view === "asks") && (
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            {[...asks]
              .sort((a, b) => b.price - a.price)
              .map((ask) => renderOrderRow(ask, false))}
          </div>
        )}

        {/* Spread indicator */}
        {view === "all" && spread !== null && (
          <div
            className="py-1.5 px-2 text-center"
            style={{ background: "var(--background)" }}
          >
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Spread
            </p>
            <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              ${spread.toFixed(4)}
              {spreadPct !== null && (
                <span
                  className="ml-1 font-normal text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  ({spreadPct}%)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Bids */}
        {(view === "all" || view === "bids") && (
          <div>
            {[...bids]
              .sort((a, b) => b.price - a.price)
              .map((bid) => renderOrderRow(bid, true))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        className="px-3 py-2"
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--background)",
        }}
      >
        <div
          className="grid gap-x-2 text-xs"
          style={{
            gridTemplateColumns: "1fr 1fr",
            color: "var(--muted)",
          }}
        >
          <span>
            Bids:{" "}
            <span style={{ color: "#22c55e" }}>
              {bids.reduce((s, b) => s + b.quantity, 0).toLocaleString()}
            </span>
          </span>
          <span className="text-right">
            Asks:{" "}
            <span style={{ color: "#ef4444" }}>
              {asks.reduce((s, a) => s + a.quantity, 0).toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
