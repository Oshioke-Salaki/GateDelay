"use client";

import { Outcome } from "./OutcomeSelector";

// ─── Helpers (mirrors OutcomeSelector) ───────────────────────────────────────

function outcomeColor(id: string, index: number): string {
  if (id.toUpperCase() === "YES") return "#22c55e";
  if (id.toUpperCase() === "NO") return "#ef4444";
  const palette = ["#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];
  return palette[index % palette.length];
}

/** Probability → badge size variant */
function sizeVariant(price: number): "lg" | "md" | "sm" {
  if (price >= 0.6) return "lg";
  if (price >= 0.3) return "md";
  return "sm";
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OutcomeBadgeProps {
  outcome: Outcome;
  /** Index used for colour palette when id isn't YES/NO */
  index?: number;
  /** Whether this badge is currently selected */
  selected?: boolean;
  /** Called when the badge is clicked (initiates trading) */
  onClick?: (outcome: Outcome) => void;
  /** Disable click interaction */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OutcomeBadge({
  outcome,
  index = 0,
  selected = false,
  onClick,
  disabled = false,
}: OutcomeBadgeProps) {
  const color = outcomeColor(outcome.id, index);
  const pct = Math.round(outcome.price * 100);
  const size = sizeVariant(outcome.price);

  const paddingClass = size === "lg" ? "px-3 py-1.5" : size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const textClass = size === "lg" ? "text-sm" : "text-xs";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick?.(outcome)}
      aria-pressed={selected}
      aria-label={`${outcome.label} — ${pct}% probability. Click to trade.`}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 ${paddingClass} ${textClass}`}
      style={{
        background: selected ? color + "28" : color + "14",
        border: `1px solid ${selected ? color + "99" : color + "44"}`,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: selected ? `0 0 0 2px ${color}33` : "none",
        ["--tw-ring-color" as string]: color,
      }}
    >
      {/* Probability dot — size encodes likelihood */}
      <span
        className="rounded-full shrink-0"
        style={{
          width: size === "lg" ? 8 : size === "md" ? 6 : 5,
          height: size === "lg" ? 8 : size === "md" ? 6 : 5,
          background: color,
        }}
        aria-hidden="true"
      />

      <span>{outcome.label}</span>

      {/* Probability pill */}
      <span
        className="rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums"
        style={{ background: color + "22", color }}
      >
        {pct}%
      </span>

      {/* Selected checkmark */}
      {selected && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M2 5l2.5 2.5L8 3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ─── Group helper ─────────────────────────────────────────────────────────────

export interface OutcomeBadgeGroupProps {
  outcomes: Outcome[];
  selectedId?: string;
  onSelect?: (outcome: Outcome) => void;
  disabled?: boolean;
  className?: string;
}

/** Renders a row of OutcomeBadges for a market. */
export function OutcomeBadgeGroup({
  outcomes,
  selectedId,
  onSelect,
  disabled,
  className = "",
}: OutcomeBadgeGroupProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Market outcomes">
      {outcomes.map((outcome, i) => (
        <OutcomeBadge
          key={outcome.id}
          outcome={outcome}
          index={i}
          selected={outcome.id === selectedId}
          onClick={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
