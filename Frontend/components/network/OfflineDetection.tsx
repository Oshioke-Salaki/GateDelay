"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConnectivity } from "../../hooks/useConnectivity";
import type { QueuedAction } from "../../hooks/useConnectivity";

// ─── Styles ───────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes od-slide-down {
    from { opacity: 0; transform: translateY(-100%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes od-slide-up {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-100%); }
  }
  @keyframes od-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes od-pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes od-bounce-in {
    0%   { transform: scale(0.85); opacity: 0; }
    70%  { transform: scale(1.04); }
    100% { transform: scale(1);    opacity: 1; }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function WifiOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

function WifiOnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: "od-spin 0.9s linear infinite", display: "block" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ─── Queue drawer ─────────────────────────────────────────────────────────────

function QueueDrawer({
  queue,
  onDequeue,
}: {
  queue: QueuedAction[];
  onDequeue: (id: string) => void;
}) {
  if (queue.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "8px",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        paddingTop: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        maxHeight: "120px",
        overflowY: "auto",
      }}
    >
      <p
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          opacity: 0.6,
          marginBottom: "2px",
        }}
      >
        Pending actions ({queue.length})
      </p>
      {queue.map((action) => (
        <div
          key={action.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "11px",
            opacity: 0.85,
          }}
        >
          <span style={{ animation: "od-pulse-dot 2s ease-in-out infinite" }}>
            •
          </span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {action.label}
          </span>
          <span style={{ opacity: 0.5, fontSize: "10px", flexShrink: 0 }}>
            {action.attempts > 0 ? `retry ${action.attempts}` : "queued"}
          </span>
          <button
            onClick={() => onDequeue(action.id)}
            aria-label={`Remove queued action: ${action.label}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.5,
              fontSize: "12px",
              padding: "0 2px",
              lineHeight: 1,
              flexShrink: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

type BannerPhase = "offline" | "syncing" | "back-online";

interface BannerConfig {
  background: string;
  border: string;
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function getBannerConfig(
  phase: BannerPhase,
  queueLength: number
): BannerConfig {
  switch (phase) {
    case "offline":
      return {
        background: "linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(185,28,28,0.95) 100%)",
        border: "rgba(239,68,68,0.4)",
        color: "#fff",
        icon: <WifiOffIcon size={15} />,
        title: "You're offline",
        subtitle:
          queueLength > 0
            ? `${queueLength} action${queueLength > 1 ? "s" : ""} queued — will sync on reconnect`
            : "Actions you take will be queued for later",
      };
    case "syncing":
      return {
        background: "linear-gradient(135deg, rgba(245,158,11,0.95) 0%, rgba(180,100,0,0.95) 100%)",
        border: "rgba(245,158,11,0.4)",
        color: "#fff",
        icon: <SpinnerIcon size={14} />,
        title: "Reconnecting…",
        subtitle:
          queueLength > 0
            ? `Syncing ${queueLength} pending action${queueLength > 1 ? "s" : ""}…`
            : "Restoring connection…",
      };
    case "back-online":
      return {
        background: "linear-gradient(135deg, rgba(34,197,94,0.95) 0%, rgba(21,128,61,0.95) 100%)",
        border: "rgba(34,197,94,0.4)",
        color: "#fff",
        icon: <WifiOnIcon size={15} />,
        title: "Back online",
        subtitle: "All pending actions have been synced",
      };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OfflineDetectionProps {
  /**
   * How long (ms) the "Back online" confirmation banner stays visible.
   * @default 3000
   */
  onlineDismissDelay?: number;
  /**
   * Show the pending-actions queue inside the banner.
   * @default true
   */
  showQueue?: boolean;
}

export default function OfflineDetection({
  onlineDismissDelay = 3000,
  showQueue = true,
}: OfflineDetectionProps) {
  const { status, isOffline, isSyncing, queue, dequeue } = useConnectivity();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState<BannerPhase>("offline");
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR-safe mount flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // Drive visibility / phase from connectivity status
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Clear any pending auto-dismiss
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (isOffline) {
      setPhase("offline");
      setLeaving(false);
      setVisible(true);
    } else if (isSyncing) {
      setPhase("syncing");
      setLeaving(false);
      setVisible(true);
    } else if (visible && !isOffline && !isSyncing) {
      // Transitioned from offline/syncing to online
      setPhase("back-online");
      setLeaving(false);
      dismissTimerRef.current = setTimeout(() => {
        setLeaving(true);
        // Remove from DOM after slide-up animation
        setTimeout(() => {
          setVisible(false);
          setLeaving(false);
        }, 300);
      }, onlineDismissDelay);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, isSyncing]);

  if (!mounted || !visible) return null;

  const cfg = getBannerConfig(phase, queue.length);

  const banner = (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        id="offline-detection-banner"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: cfg.background,
          borderBottom: `1px solid ${cfg.border}`,
          color: cfg.color,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          animation: leaving ? "od-slide-up 0.3s ease-in forwards" : "od-slide-down 0.3s ease-out",
          fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        }}
      >
        <div
          style={{
            maxWidth: "680px",
            margin: "0 auto",
            padding: "10px 16px",
          }}
        >
          {/* Main row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {/* Icon */}
            <span
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                animation: phase === "back-online" ? "od-bounce-in 0.4s ease-out" : undefined,
              }}
            >
              {cfg.icon}
            </span>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "13px",
                  lineHeight: 1.3,
                  letterSpacing: "0.01em",
                }}
              >
                {cfg.title}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  opacity: 0.85,
                  lineHeight: 1.4,
                }}
              >
                {cfg.subtitle}
              </p>
            </div>

            {/* Status badge */}
            <span
              style={{
                flexShrink: 0,
                padding: "2px 8px",
                borderRadius: "20px",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {phase === "offline"
                ? "OFFLINE"
                : phase === "syncing"
                ? "SYNCING"
                : "ONLINE ✓"}
            </span>
          </div>

          {/* Queue drawer (offline phase only) */}
          {showQueue && phase === "offline" && queue.length > 0 && (
            <QueueDrawer queue={queue} onDequeue={dequeue} />
          )}
        </div>
      </div>
    </>
  );

  return createPortal(banner, document.body);
}
