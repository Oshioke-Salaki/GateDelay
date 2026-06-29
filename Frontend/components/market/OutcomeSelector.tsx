"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Outcome {
  /** Unique identifier for the outcome (e.g. "YES", "NO", or an index) */
  id: string;
  /** Human-readable label shown to the user */
  label: string;
  /**
   * Current probability / price expressed as a value between 0 and 1.
   * e.g. 0.62 means 62¢ per share.
   */
  price: number;
  /** Optional description shown as secondary text */
  description?: string;
}

export type TradeSide = "buy" | "sell";

export interface OutcomeSelectorProps {
  /** All outcomes available for this market */
  outcomes: Outcome[];
  /** Currently selected outcome id */
  selectedId?: string;
  /** Whether the user is buying or selling */
  side?: TradeSide;
  /** Called when the user selects an outcome */
  onSelect?: (outcome: Outcome) => void;
  /** Called when the user toggles the trade side */
  onSideChange?: (side: TradeSide) => void;
  /** Whether the market is still open for trading */
  disabled?: boolean;
  /** Optional className for the outer wrapper */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map an outcome id to a deterministic accent colour */
function outcomeColor(id: string, index: number): string {
  // YES → green, NO → red, others cycle through a palette
  if (id.toUpperCase() === "YES") return "#22c55e";
  if (id.toUpperCase() === "NO") return "#ef4444";
  const palette = ["#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];
  return palette[index % palette.length];
}

/** Format a 0–1 price as cents (e.g. 0.62 → "62¢") */
function formatPrice(price: number): string {
  return `${Math.round(price * 100)}¢`;
}

/** Format a 0–1 price as a percentage (e.g. 0.62 → "62%") */
function formatPct(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PriceBarProps {
  price: number;
  color: string;
  animate: boolean;
}

function PriceBar({ price, color, animate }: PriceBarProps) {
  return (
    <div
      className="h-1 rounded-full overflow-hidden"
      style={{ background: color + "22" }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${price * 100}%`,
          background: color,
          transition: animate ? "width 0.4s ease" : "none",
        }}
      />
    </div>
  );
}

interface PriceTickerProps {
  price: number;
  prevPrice: number | null;
  color: string;
}

function PriceTicker({ price, prevPrice, color }: PriceTickerProps) {
  const direction =
    prevPrice === null ? null : price > prevPrice ? "up" : price < prevPrice ? "down" : null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-bold tabular-nums" style={{ color }}>
        {formatPrice(price)}
      </span>
      {direction && (
        <span
          className="text-xs font-semibold"
          style={{ color: direction === "up" ? "#22c55e" : "#ef4444" }}
          aria-label={direction === "up" ? "price increased" : "price decreased"}
        >
          {direction === "up" ? "▲" : "▼"}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OutcomeSelector({
  outcomes,
  selectedId,
  side = "buy",
  onSelect,
  onSideChange,
  disabled = false,
  className = "",
}: OutcomeSelectorProps) {
  // Track previous prices to show tick direction
  const prevPricesRef = useRef<Record<string, number>>({});
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [animateBars, setAnimateBars] = useState(false);

  // Detect price changes and update previous prices snapshot
  useEffect(() => {
    const current: Record<string, number> = {};
    outcomes.forEach((o) => {
      current[o.id] = o.price;
    });

    // Only update prevPrices when something actually changed
    const changed = outcomes.some(
      (o) => prevPricesRef.current[o.id] !== undefined && prevPricesRef.current[o.id] !== o.price
    );

    if (changed) {
      setPrevPrices({ ...prevPricesRef.current });
      setAnimateBars(true);
    }

    prevPricesRef.current = current;
  }, [outcomes]);

  if (outcomes.length === 0) {
    return (
      <div
        className={`rounded-xl p-4 text-sm text-center ${className}`}
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        No outcomes available for this market.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Select Outcome
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {outcomes.length} outcome{outcomes.length !== 1 ? "s" : ""} · prices update in real-time
          </p>
        </div>

        {/* Buy / Sell toggle */}
        {onSideChange && (
          <div
            className="flex rounded-lg overflow-hidden text-xs font-semibold"
            style={{ border: "1px solid var(--border)" }}
            role="group"
            aria-label="Trade side"
          >
            {(["buy", "sell"] as TradeSide[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => !disabled && onSideChange(s)}
                disabled={disabled}
                aria-pressed={side === s}
                className="px-3 py-1.5 capitalize transition-colors disabled:opacity-40"
                style={{
                  background:
                    side === s
                      ? s === "buy"
                        ? "#22c55e"
                        : "#ef4444"
                      : "transparent",
                  color: side === s ? "#fff" : "var(--muted)",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Outcome list ───────────────────────────────────────────────────── */}
      <div className="p-3 space-y-2" role="listbox" aria-label="Market outcomes">
        {outcomes.map((outcome, index) => {
          const color = outcomeColor(outcome.id, index);
          const isSelected = outcome.id === selectedId;
          const prev = prevPrices[outcome.id] ?? null;

          return (
            <button
              key={outcome.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              onClick={() => !disabled && onSelect?.(outcome)}
              className="w-full text-left rounded-lg px-4 py-3 space-y-2 transition-all focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: isSelected ? color + "14" : "var(--background)",
                border: `1px solid ${isSelected ? color + "66" : "var(--border)"}`,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                // Focus ring colour matches outcome accent
                ["--tw-ring-color" as string]: color,
              }}
            >
              {/* Row: label + price ticker + probability */}
              <div className="flex items-center justify-between gap-3">
                {/* Left: colour dot + label */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 h-2.5 w-2.5 rounded-full"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold leading-none truncate"
                      style={{ color: isSelected ? color : "var(--foreground)" }}
                    >
                      {outcome.label}
                    </p>
                    {outcome.description && (
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--muted)" }}
                      >
                        {outcome.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: price + probability */}
                <div className="shrink-0 text-right space-y-0.5">
                  <PriceTicker price={outcome.price} prevPrice={prev} color={color} />
                  <p className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                    {formatPct(outcome.price)} probability
                  </p>
                </div>
              </div>

              {/* Probability bar */}
              <PriceBar price={outcome.price} color={color} animate={animateBars} />

              {/* Selected badge */}
              {isSelected && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: color + "22", color }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Selected · {side === "buy" ? "Buying" : "Selling"} {outcome.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Footer: total probability check ───────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
      >
        <span>Total probability</span>
        <span
          className="font-semibold tabular-nums"
          style={{
            color:
              Math.abs(outcomes.reduce((s, o) => s + o.price, 0) - 1) < 0.02
                ? "#22c55e"
                : "#f59e0b",
          }}
        >
          {formatPct(outcomes.reduce((s, o) => s + o.price, 0))}
        </span>
      </div>
    </div>
  );
}
