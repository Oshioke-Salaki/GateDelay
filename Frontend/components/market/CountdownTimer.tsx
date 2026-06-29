"use client";

import { useEffect, useState } from "react";
import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CountdownTimerProps {
  /** ISO 8601 string or Date — the market resolution time (any timezone) */
  resolvesAt: string | Date;
  /** Market status — drives the resolved/closed display */
  status?: "open" | "closed" | "resolved" | "disputed";
  /** Optional className for the outer wrapper */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total seconds remaining (negative when past)
}

function toParts(target: Date): Parts {
  const total = differenceInSeconds(target, new Date());
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total };
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, total };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Unit cell ────────────────────────────────────────────────────────────────

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="text-lg font-bold tabular-nums leading-none"
        style={{ color: "var(--foreground)" }}
      >
        {value}
      </span>
      <span className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span className="text-lg font-bold leading-none pb-3" style={{ color: "var(--muted)" }}>
      :
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CountdownTimer({
  resolvesAt,
  status = "open",
  className = "",
}: CountdownTimerProps) {
  const target = resolvesAt instanceof Date ? resolvesAt : new Date(resolvesAt);
  const [parts, setParts] = useState<Parts>(() => toParts(target));

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setParts(toParts(target)), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolved / closed states ──────────────────────────────────────────────
  if (status === "resolved") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
        style={{ background: "#6366f122", color: "#6366f1" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#6366f1" }} aria-hidden />
        Market resolved
      </div>
    );
  }

  if (status === "disputed") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
        style={{ background: "#ef444422", color: "#ef4444" }}
      >
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} aria-hidden />
        Outcome disputed
      </div>
    );
  }

  // ── Past resolution time but not yet marked resolved ──────────────────────
  if (parts.total <= 0) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
        style={{ background: "#f59e0b22", color: "#f59e0b" }}
        aria-label="Market resolution pending"
      >
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#f59e0b" }} aria-hidden />
        Resolving soon
      </div>
    );
  }

  // ── Urgency colour: red < 1h, amber < 24h, green otherwise ───────────────
  const urgent = parts.total < 3600;
  const warning = parts.total < 86400;
  const color = urgent ? "#ef4444" : warning ? "#f59e0b" : "#22c55e";

  // ── Compact display for > 7 days ──────────────────────────────────────────
  if (parts.days >= 7) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
        style={{ background: color + "22", color }}
        aria-label={`Resolves in ${formatDistanceToNowStrict(target)}`}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
        {formatDistanceToNowStrict(target, { addSuffix: false })}
      </div>
    );
  }

  // ── Full D:HH:MM:SS countdown ─────────────────────────────────────────────
  return (
    <div
      className={`inline-flex flex-col items-center gap-1 ${className}`}
      aria-label={`Resolves in ${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.seconds}s`}
      aria-live="off"
    >
      {/* Label */}
      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--muted)" }}>
        Resolves in
      </p>

      {/* Digit display */}
      <div
        className="flex items-end gap-1.5 rounded-xl px-3 py-2"
        style={{ background: color + "14", border: `1px solid ${color}33` }}
      >
        {parts.days > 0 && (
          <>
            <Unit value={String(parts.days)} label="day" />
            <Sep />
          </>
        )}
        <Unit value={pad(parts.hours)} label="hr" />
        <Sep />
        <Unit value={pad(parts.minutes)} label="min" />
        <Sep />
        <Unit value={pad(parts.seconds)} label="sec" />
      </div>

      {/* Timezone note */}
      <p className="text-[10px]" style={{ color: "var(--muted)" }}>
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
    </div>
  );
}
