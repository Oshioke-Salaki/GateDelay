"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLatency, LatencyStatus } from "../../hooks/useLatency";

// ─── Config ───────────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  color: string;        // CSS hex / rgba
  bg: string;
  border: string;
  dotColor: string;
  barHeights: [string, string, string]; // 3 signal bars (low→high)
  warnBanner: boolean;
  warnText: string;
}

const STATUS_CONFIG: Record<LatencyStatus, StatusConfig> = {
  excellent: {
    label: "Excellent",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    dotColor: "#22c55e",
    barHeights: ["6px", "10px", "14px"],
    warnBanner: false,
    warnText: "",
  },
  fair: {
    label: "Fair",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    dotColor: "#f59e0b",
    barHeights: ["6px", "10px", "5px"],
    warnBanner: false,
    warnText: "",
  },
  poor: {
    label: "Poor",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    dotColor: "#ef4444",
    barHeights: ["6px", "4px", "4px"],
    warnBanner: true,
    warnText:
      "⚠️ High network latency detected. Trade operations may be slower than usual.",
  },
  unknown: {
    label: "Measuring…",
    color: "#71717a",
    bg: "rgba(113,113,122,0.10)",
    border: "rgba(113,113,122,0.25)",
    dotColor: "#71717a",
    barHeights: ["6px", "6px", "6px"],
    warnBanner: false,
    warnText: "",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Three animated signal bars (like a WiFi / cellular icon). */
function SignalBars({
  status,
  measuring,
}: {
  status: LatencyStatus;
  measuring: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", height: "14px" }}
    >
      {cfg.barHeights.map((h, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: "3px",
            height: h,
            borderRadius: "1.5px",
            background: cfg.dotColor,
            opacity: measuring ? 0.4 + i * 0.2 : 1,
            transition: "height 0.4s ease, opacity 0.3s ease",
            animation: measuring ? `latency-pulse 1.2s ease-in-out ${i * 0.2}s infinite` : "none",
          }}
        />
      ))}
    </span>
  );
}

/** Pulse dot (animated while measuring). */
function PulseDot({ color, measuring }: { color: string; measuring: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-block",
        width: "8px",
        height: "8px",
        flexShrink: 0,
      }}
    >
      {measuring && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            animation: "latency-ripple 1.2s ease-out infinite",
          }}
        />
      )}
      <span
        style={{
          position: "absolute",
          inset: "1px",
          borderRadius: "50%",
          background: color,
          transition: "background 0.3s ease",
        }}
      />
    </span>
  );
}

/** Tooltip overlay shown on hover. */
function Tooltip({
  latencyMs,
  averageMs,
  status,
  lastMeasuredAt,
  sampleCount,
}: {
  latencyMs: number | null;
  averageMs: number | null;
  status: LatencyStatus;
  lastMeasuredAt: string | null;
  sampleCount: number;
}) {
  const cfg = STATUS_CONFIG[status];
  const lastTime = lastMeasuredAt
    ? new Date(lastMeasuredAt).toLocaleTimeString()
    : "—";

  return (
    <div
      role="tooltip"
      id="latency-tooltip"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        zIndex: 60,
        minWidth: "200px",
        borderRadius: "10px",
        padding: "12px 14px",
        background: "var(--card)",
        border: `1px solid ${cfg.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        fontSize: "12px",
        lineHeight: 1.5,
        color: "var(--foreground)",
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          fontWeight: 600,
          marginBottom: "8px",
          color: cfg.color,
          fontSize: "13px",
        }}
      >
        Network Latency
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
        <span style={{ color: "var(--muted)" }}>Status</span>
        <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>

        <span style={{ color: "var(--muted)" }}>Latest RTT</span>
        <span style={{ fontWeight: 500 }}>
          {latencyMs !== null ? `${latencyMs} ms` : "—"}
        </span>

        <span style={{ color: "var(--muted)" }}>Average RTT</span>
        <span style={{ fontWeight: 500 }}>
          {averageMs !== null ? `${averageMs} ms` : "—"}
        </span>

        <span style={{ color: "var(--muted)" }}>Samples</span>
        <span>{sampleCount}</span>

        <span style={{ color: "var(--muted)" }}>Last check</span>
        <span>{lastTime}</span>
      </div>

      <div
        style={{
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px solid var(--border)",
          fontSize: "11px",
          color: "var(--muted)",
        }}
      >
        🟢 ≤ 100 ms · 🟡 101–300 ms · 🔴 &gt; 300 ms
      </div>
    </div>
  );
}

// ─── Warning Banner ───────────────────────────────────────────────────────────

function WarningBanner({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      id="latency-warning-banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "8px 16px",
        background: "rgba(239,68,68,0.10)",
        borderBottom: "1px solid rgba(239,68,68,0.30)",
        color: "#ef4444",
        fontSize: "13px",
        fontWeight: 500,
        animation: "latency-slide-down 0.25s ease-out",
      }}
    >
      <span>{text}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss network warning"
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#ef4444",
          opacity: 0.7,
          fontSize: "16px",
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: "4px",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LatencyIndicatorProps {
  /** URL of the lightweight probe endpoint. */
  probeUrl?: string;
  /** Show the numeric ms value next to the status label. */
  showMs?: boolean;
  /** If false, the component renders only the compact badge. */
  showLabel?: boolean;
}

export default function LatencyIndicator({
  probeUrl = "/api/ping",
  showMs = true,
  showLabel = true,
}: LatencyIndicatorProps) {
  const { latencyMs, averageMs, status, measuring, lastMeasuredAt, sampleCount, measure } =
    useLatency(probeUrl);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Track client-side mount for SSR-safe portal rendering
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const cfg = STATUS_CONFIG[status];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-show banner when status flips to poor again
  useEffect(() => {
    if (status !== "poor") {
      setBannerDismissed(false);
    }
  }, [status]);

  // Close tooltip on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setTooltipVisible(false);
    }
  }, []);

  useEffect(() => {
    if (tooltipVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [tooltipVisible, handleClickOutside]);

  const showWarning = cfg.warnBanner && !bannerDismissed;

  return (
    <>
      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes latency-pulse {
          0%, 100% { opacity: 0.5; transform: scaleY(0.8); }
          50%       { opacity: 1;   transform: scaleY(1.1); }
        }
        @keyframes latency-ripple {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0;   }
        }
        @keyframes latency-slide-down {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/*
       * Warning banner — rendered via portal so it appears below the navbar
       * at the top of <body>, without disrupting the flex navbar layout.
       */}
      {mounted && showWarning &&
        createPortal(
          <WarningBanner
            text={cfg.warnText}
            onDismiss={() => setBannerDismissed(true)}
          />,
          document.body
        )
      }

      {/* Badge + tooltip wrapper */}
      <div
        ref={wrapperRef}
        style={{ position: "relative", display: "inline-flex" }}
      >
        <button
          id="latency-indicator-btn"
          onClick={() => {
            setTooltipVisible((v) => !v);
            measure(); // trigger fresh measurement on click
          }}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          aria-label={`Network latency: ${cfg.label}${latencyMs !== null ? ` (${latencyMs} ms)` : ""}`}
          aria-describedby="latency-tooltip"
          aria-expanded={tooltipVisible}
          title="Network latency"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "20px",
            border: `1px solid ${cfg.border}`,
            background: cfg.bg,
            cursor: "pointer",
            userSelect: "none",
            transition: "background 0.3s ease, border-color 0.3s ease",
            fontSize: "12px",
            fontWeight: 600,
            color: cfg.color,
            whiteSpace: "nowrap",
          }}
        >
          <PulseDot color={cfg.dotColor} measuring={measuring} />
          <SignalBars status={status} measuring={measuring} />
          {showLabel && (
            <span style={{ transition: "color 0.3s ease" }}>{cfg.label}</span>
          )}
          {showMs && latencyMs !== null && (
            <span
              style={{
                fontWeight: 400,
                opacity: 0.75,
                fontSize: "11px",
              }}
            >
              {latencyMs} ms
            </span>
          )}
        </button>

        {tooltipVisible && (
          <Tooltip
            latencyMs={latencyMs}
            averageMs={averageMs}
            status={status}
            lastMeasuredAt={lastMeasuredAt}
            sampleCount={sampleCount}
          />
        )}
      </div>
    </>
  );
}

