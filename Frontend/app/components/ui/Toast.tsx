"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast, type Toast } from "../../../hooks/useToast";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSuccess() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
      <path
        d="M6 10.5l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconError() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2L18.66 17H1.34L10 2z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 2l10 10M12 2L2 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: {
    icon: <IconSuccess />,
    color: "#22c55e",
    label: "Success",
  },
  error: {
    icon: <IconError />,
    color: "#ef4444",
    label: "Error",
  },
  warning: {
    icon: <IconWarning />,
    color: "#f59e0b",
    label: "Warning",
  },
  info: {
    icon: <IconInfo />,
    color: "#3b82f6",
    label: "Info",
  },
} as const;

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  duration,
  paused,
  color,
}: {
  duration: number;
  paused: boolean;
  color: string;
}) {
  return (
    <motion.div
      initial={{ scaleX: 1 }}
      animate={{ scaleX: paused ? undefined : 0 }}
      transition={{ duration: duration / 1000, ease: "linear" }}
      style={{
        transformOrigin: "left",
        height: 3,
        background: color,
        opacity: 0.6,
        borderRadius: "0 0 8px 8px",
      }}
    />
  );
}

// ─── Single toast item ────────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(toast.duration ?? 5000);
  const startedAtRef = useRef(Date.now());

  const config = TYPE_CONFIG[toast.type];

  // Auto-dismiss with pause-on-hover support
  useEffect(() => {
    if (!toast.duration) return; // 0 = persistent

    function start() {
      timerRef.current = setTimeout(() => dismiss(toast.id), remainingRef.current);
      startedAtRef.current = Date.now();
    }

    start();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, dismiss]);

  function handleMouseEnter() {
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startedAtRef.current;
    }
  }

  function handleMouseLeave() {
    pausedRef.current = false;
    if (!toast.duration) return;
    timerRef.current = setTimeout(() => dismiss(toast.id), remainingRef.current);
    startedAtRef.current = Date.now();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: "var(--card)",
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${config.color}`,
        borderRadius: 10,
        overflow: "hidden",
        minWidth: 300,
        maxWidth: 420,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        pointerEvents: "all",
      }}
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <span style={{ color: config.color, flexShrink: 0, marginTop: 1 }}>
          {config.icon}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p
              className="text-sm font-semibold leading-snug"
              style={{ color: "var(--foreground)" }}
            >
              {toast.title}
            </p>
          )}
          {toast.message && (
            <p
              className="text-sm leading-snug mt-0.5"
              style={{ color: "var(--muted)" }}
            >
              {toast.message}
            </p>
          )}

          {/* Action button */}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                dismiss(toast.id);
              }}
              className="mt-2 text-xs font-semibold underline underline-offset-2 cursor-pointer"
              style={{ color: config.color }}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 cursor-pointer rounded-md p-1 transition-colors"
          style={{ color: "var(--muted)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--muted)")
          }
        >
          <IconClose />
        </button>
      </div>

      {/* Progress bar */}
      {!!toast.duration && (
        <ProgressBar
          duration={remainingRef.current}
          paused={pausedRef.current}
          color={config.color}
        />
      )}
    </motion.div>
  );
}

// ─── Toast container ──────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence initial={false} mode="sync">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
