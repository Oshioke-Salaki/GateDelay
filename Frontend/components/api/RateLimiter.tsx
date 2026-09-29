"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

type RateLimitStatus = "idle" | "ok" | "limited" | "cooldown";

interface RateLimiterProps {
  limit?: number;
  windowMs?: number;
  className?: string;
}

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const seconds = Math.ceil(safeMs / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export default function RateLimiter({
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  className = "",
}: RateLimiterProps) {
  const [requestCount, setRequestCount] = useState(0);
  const [windowStart, setWindowStart] = useState(Date.now());
  const [lastRetryAt, setLastRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const windowElapsed = now - windowStart;
  const windowRemaining = Math.max(0, windowMs - windowElapsed);
  const resetAt = windowStart + windowMs;
  const isWindowExpired = windowElapsed >= windowMs;

  useEffect(() => {
    if (isWindowExpired) {
      setWindowStart(now);
      setRequestCount(0);
    }
  }, [isWindowExpired, now]);

  const remainingRequests = Math.max(0, limit - requestCount);
  const isLimited = requestCount >= limit;
  const status: RateLimitStatus = isLimited ? "limited" : windowRemaining > 0 ? "ok" : "cooldown";

  const percentUsed = Math.min(100, (requestCount / limit) * 100);

  const statusCopy = useMemo(() => {
    if (status === "limited") {
      return {
        title: "Rate limit reached",
        detail: "New requests are paused until the window resets.",
        tone: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        icon: AlertTriangle,
      };
    }
    if (status === "cooldown") {
      return {
        title: "Cooling down",
        detail: "The request window is refreshing now.",
        tone: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        icon: Clock3,
      };
    }
    return {
      title: "Within limits",
      detail: "API usage is healthy and retries are available.",
      tone: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      icon: CheckCircle2,
    };
  }, [status]);
  const StatusIcon = statusCopy.icon;

  const simulateRequest = () => {
    if (isLimited) {
      setLastRetryAt(Date.now());
      return;
    }
    if (windowElapsed >= windowMs) {
      setWindowStart(Date.now());
      setRequestCount(1);
      setLastRetryAt(Date.now());
      return;
    }
    setRequestCount((current) => current + 1);
    setLastRetryAt(Date.now());
  };

  const retryNow = () => {
    setWindowStart(Date.now());
    setRequestCount(0);
    setLastRetryAt(Date.now());
  };

  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--muted)" }}>
            API rate limiter
          </p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Market request protection
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Detects rate limit hits, shows current status, and offers a retry path with a live cooldown timer.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${statusCopy.bg} ${statusCopy.tone}`} style={{ borderColor: "var(--border)" }}>
          <StatusIcon size={16} />
          <span>{statusCopy.title}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--muted)" }}>Requests used</span>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>
              {requestCount} / {limit}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 transition-all" style={{ width: `${percentUsed}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
            <span>{remainingRequests} remaining</span>
            <span>Window resets in {formatDuration(windowRemaining)}</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${statusCopy.bg} ${statusCopy.border}`}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            <StatusIcon size={16} />
            <span>{statusCopy.title}</span>
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {statusCopy.detail}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Reset at</div>
              <div className="mt-1 font-semibold">{new Date(resetAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
            </div>
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Last retry</div>
              <div className="mt-1 font-semibold">{lastRetryAt ? new Date(lastRetryAt).toLocaleTimeString() : "None yet"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={simulateRequest} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: isLimited ? "#ef4444" : "#0f766e" }}>
          <RefreshCw size={16} />
          Simulate request
        </button>
        <button onClick={retryNow} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}>
          <ShieldAlert size={16} />
          Retry and reset
        </button>
        <div className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          <ShieldCheck size={16} />
          Auto-resets in {formatDuration(windowRemaining)}
        </div>
      </div>
    </div>
  );
}
