"use client";

import { useState, useCallback, useId } from "react";
import {
  subHours,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
  parseISO,
  isValid,
  isBefore,
  startOfDay,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresetRange = "1H" | "1D" | "1W" | "1M" | "1Y" | "All";

export interface CustomRange {
  from: Date;
  to: Date;
}

export type TimeRange =
  | { type: "preset"; preset: PresetRange }
  | { type: "custom"; range: CustomRange };

export interface TimeRangeSelectorProps {
  /** Currently active selection */
  value: TimeRange;
  /** Called whenever the user changes the selection */
  onChange: (range: TimeRange) => void;
  /** Accent colour used for the active state */
  accentColor?: string;
  /** Earliest date the user can pick (defaults to no limit) */
  minDate?: Date;
  /** Latest date the user can pick (defaults to today) */
  maxDate?: Date;
  /** Extra class names for the root element */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PRESET_RANGES: PresetRange[] = ["1H", "1D", "1W", "1M", "1Y", "All"];

/**
 * Returns the [from, to] Date pair for a preset range.
 * "All" returns from = epoch start, to = now.
 */
export function presetToDates(preset: PresetRange): CustomRange {
  const now = new Date();
  switch (preset) {
    case "1H":  return { from: subHours(now, 1),  to: now };
    case "1D":  return { from: subDays(now, 1),   to: now };
    case "1W":  return { from: subWeeks(now, 1),  to: now };
    case "1M":  return { from: subMonths(now, 1), to: now };
    case "1Y":  return { from: subYears(now, 1),  to: now };
    case "All": return { from: new Date(0),        to: now };
  }
}

/**
 * Resolves any TimeRange to a concrete { from, to } pair.
 */
export function resolveRange(range: TimeRange): CustomRange {
  if (range.type === "preset") return presetToDates(range.preset);
  return range.range;
}

/** Format a Date as the value string expected by <input type="date"> */
function toInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Parse an <input type="date"> value string to a Date (start of day) */
function fromInputValue(s: string): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? startOfDay(d) : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimeRangeSelector({
  value,
  onChange,
  accentColor = "#22c55e",
  minDate,
  maxDate = new Date(),
  className = "",
}: TimeRangeSelectorProps) {
  const uid = useId();

  // Whether the custom-range panel is open
  const [customOpen, setCustomOpen] = useState(value.type === "custom");

  // Local draft state for the custom inputs (avoids firing onChange on every keystroke)
  const initialCustom =
    value.type === "custom"
      ? value.range
      : presetToDates("1M");

  const [draftFrom, setDraftFrom] = useState<string>(toInputValue(initialCustom.from));
  const [draftTo, setDraftTo]     = useState<string>(toInputValue(initialCustom.to));
  const [customError, setCustomError] = useState<string | null>(null);

  // ── Preset click ────────────────────────────────────────────────────────────
  const handlePreset = useCallback(
    (preset: PresetRange) => {
      setCustomOpen(false);
      setCustomError(null);
      onChange({ type: "preset", preset });
    },
    [onChange],
  );

  // ── Custom range apply ───────────────────────────────────────────────────────
  const applyCustom = useCallback(() => {
    const from = fromInputValue(draftFrom);
    const to   = fromInputValue(draftTo);

    if (!from || !to) {
      setCustomError("Please select both a start and end date.");
      return;
    }
    if (!isBefore(from, to) && from.getTime() !== to.getTime()) {
      setCustomError("Start date must be before end date.");
      return;
    }
    if (minDate && isBefore(from, minDate)) {
      setCustomError(`Start date cannot be before ${format(minDate, "MMM d, yyyy")}.`);
      return;
    }
    if (isBefore(maxDate, to)) {
      setCustomError(`End date cannot be after ${format(maxDate, "MMM d, yyyy")}.`);
      return;
    }

    setCustomError(null);
    onChange({ type: "custom", range: { from, to } });
  }, [draftFrom, draftTo, minDate, maxDate, onChange]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activePreset = value.type === "preset" ? value.preset : null;

  const accentBg     = `${accentColor}22`;
  const accentBorder = `${accentColor}55`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* ── Preset buttons + Custom toggle ─────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap">
        {PRESET_RANGES.map((preset) => {
          const isActive = activePreset === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={isActive}
              onClick={() => handlePreset(preset)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
              style={{
                background:   isActive ? accentBg     : "transparent",
                color:        isActive ? accentColor  : "var(--muted)",
                border:       `1px solid ${isActive ? accentBorder : "var(--border)"}`,
                // ring colour for keyboard focus
                "--tw-ring-color": accentColor,
              } as React.CSSProperties}
            >
              {preset}
            </button>
          );
        })}

        {/* Custom toggle */}
        <button
          type="button"
          aria-expanded={customOpen}
          aria-controls={`${uid}-custom-panel`}
          onClick={() => setCustomOpen((o) => !o)}
          className="text-xs px-2.5 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 ml-1"
          style={{
            background:   customOpen || value.type === "custom" ? accentBg     : "transparent",
            color:        customOpen || value.type === "custom" ? accentColor  : "var(--muted)",
            border:       `1px solid ${customOpen || value.type === "custom" ? accentBorder : "var(--border)"}`,
            "--tw-ring-color": accentColor,
          } as React.CSSProperties}
        >
          Custom
        </button>
      </div>

      {/* ── Custom date range panel ─────────────────────────────────────────── */}
      {customOpen && (
        <div
          id={`${uid}-custom-panel`}
          role="group"
          aria-label="Custom date range"
          className="flex flex-wrap items-end gap-2 rounded-lg px-3 py-2.5"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          {/* From */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${uid}-from`}
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              From
            </label>
            <input
              id={`${uid}-from`}
              type="date"
              value={draftFrom}
              min={minDate ? toInputValue(minDate) : undefined}
              max={draftTo || toInputValue(maxDate)}
              onChange={(e) => {
                setDraftFrom(e.target.value);
                setCustomError(null);
              }}
              className="text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-2"
              style={{
                background:    "var(--card)",
                border:        "1px solid var(--border)",
                color:         "var(--foreground)",
                colorScheme:   "dark light",
                "--tw-ring-color": accentColor,
              } as React.CSSProperties}
            />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${uid}-to`}
              className="text-[10px] uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              To
            </label>
            <input
              id={`${uid}-to`}
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              max={toInputValue(maxDate)}
              onChange={(e) => {
                setDraftTo(e.target.value);
                setCustomError(null);
              }}
              className="text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-2"
              style={{
                background:    "var(--card)",
                border:        "1px solid var(--border)",
                color:         "var(--foreground)",
                colorScheme:   "dark light",
                "--tw-ring-color": accentColor,
              } as React.CSSProperties}
            />
          </div>

          {/* Apply */}
          <button
            type="button"
            onClick={applyCustom}
            className="text-xs px-3 py-1 rounded-md font-medium transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{
              background:        accentColor,
              color:             "#fff",
              "--tw-ring-color": accentColor,
            } as React.CSSProperties}
          >
            Apply
          </button>

          {/* Validation error */}
          {customError && (
            <p
              role="alert"
              className="w-full text-[11px] mt-0.5"
              style={{ color: "#ef4444" }}
            >
              {customError}
            </p>
          )}

          {/* Active custom range summary */}
          {value.type === "custom" && !customError && (
            <p className="w-full text-[11px]" style={{ color: "var(--muted)" }}>
              Showing{" "}
              <span style={{ color: "var(--foreground)" }}>
                {format(value.range.from, "MMM d, yyyy")}
              </span>{" "}
              →{" "}
              <span style={{ color: "var(--foreground)" }}>
                {format(value.range.to, "MMM d, yyyy")}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
