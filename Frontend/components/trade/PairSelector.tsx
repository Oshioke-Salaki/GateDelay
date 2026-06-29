"use client";

import { useState } from "react";

export interface TradingPair {
  id: string;
  label: string;
  baseOutcome: string;
  quoteOutcome: string;
  currentPrice: number;
  spread: number;
  volume24h: number;
}

export interface PairSelectorProps {
  pairs: TradingPair[];
  selectedPairId?: string;
  onSelectPair?: (pair: TradingPair) => void;
  disabled?: boolean;
  className?: string;
}

function formatPrice(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

function formatSpread(spread: number): string {
  return `${(spread * 100).toFixed(2)}%`;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

export default function PairSelector({
  pairs,
  selectedPairId,
  onSelectPair,
  disabled = false,
  className = "",
}: PairSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (pairs.length === 0) {
    return (
      <div
        className={`rounded-xl p-4 text-sm text-center ${className}`}
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        No trading pairs available.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Trading Pairs
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {pairs.length} pair{pairs.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      {/* Pairs list */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {pairs.map((pair) => {
          const isSelected = pair.id === selectedPairId;
          const isHovered = pair.id === hoveredId;

          return (
            <button
              key={pair.id}
              type="button"
              onClick={() => !disabled && onSelectPair?.(pair)}
              onMouseEnter={() => setHoveredId(pair.id)}
              onMouseLeave={() => setHoveredId(null)}
              disabled={disabled}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                background: isSelected ? "#3b82f614" : isHovered ? "#3b82f608" : "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Pair label and outcomes */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {pair.label}
                    </p>
                    {isSelected && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#3b82f622", color: "#3b82f6" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path
                            d="M2 5l2.5 2.5L8 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {pair.baseOutcome} / {pair.quoteOutcome}
                  </p>
                </div>

                {/* Right: Price, spread, volume */}
                <div className="flex items-center gap-6 text-right shrink-0">
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Price
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatPrice(pair.currentPrice)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Spread
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
                      {formatSpread(pair.spread)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      24h Volume
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatVolume(pair.volume24h)}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
