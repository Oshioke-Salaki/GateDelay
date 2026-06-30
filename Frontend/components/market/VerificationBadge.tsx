"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import { BadgeCheck, ChevronDown, Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

type VerificationLevel = "unverified" | "reviewed" | "verified" | "trusted";

interface VerificationBadgeProps {
  level?: VerificationLevel;
  marketName?: string;
  className?: string;
}

const LEVELS: Record<VerificationLevel, { label: string; color: string; bg: string; icon: ComponentType<{ size?: number }>; criteria: string }> = {
  unverified: { label: "Unverified", color: "#94a3b8", bg: "rgba(148,163,184,0.12)", icon: ShieldQuestion, criteria: "No completed checks yet." },
  reviewed: { label: "Reviewed", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: ShieldAlert, criteria: "Basic market review completed." },
  verified: { label: "Verified", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: ShieldCheck, criteria: "Oracle and metadata checks passed." },
  trusted: { label: "Trusted", color: "#2563eb", bg: "rgba(37,99,235,0.12)", icon: BadgeCheck, criteria: "Repeatedly verified with strong history." },
};

export default function VerificationBadge({ level = "verified", marketName = "Market", className = "" }: VerificationBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const config = LEVELS[level];
  const LevelIcon = config.icon;

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-transform hover:scale-[1.01]"
        style={{ background: config.bg, color: config.color, borderColor: `${config.color}44` }}
        aria-expanded={showDetails}
      >
        <LevelIcon size={16} />
        <span>{config.label}</span>
        <ChevronDown size={14} className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {showDetails && (
        <div className="rounded-2xl border p-4 text-sm shadow-sm" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}>
          <div className="flex items-center gap-2 font-semibold">
            <Shield size={16} style={{ color: config.color }} />
            <span>{marketName}</span>
          </div>
          <p className="mt-2" style={{ color: "var(--muted)" }}>
            {config.criteria}
          </p>
          <div className="mt-3 grid gap-2 text-xs">
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              Verification level is color-coded for fast scanning.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
