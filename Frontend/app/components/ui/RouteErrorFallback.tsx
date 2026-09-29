"use client";

import { useEffect } from "react";
import { ErrorLogger } from "./ErrorBoundary";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RouteErrorFallbackProps {
  /** The error thrown during render — provided by Next.js */
  error: Error & { digest?: string };
  /** Calling this re-renders the route segment — provided by Next.js */
  reset: () => void;
  /** Human-readable name of the route shown in the fallback heading */
  routeName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RouteErrorFallback({
  error,
  reset,
  routeName = "this page",
}: RouteErrorFallbackProps) {
  // Log to localStorage + console (same sink as the class-based ErrorBoundary)
  useEffect(() => {
    ErrorLogger.log(error, { componentStack: "" }, "page");
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="w-full max-w-lg rounded-2xl p-8 shadow-xl space-y-6"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        {/* Icon + heading */}
        <div className="text-center space-y-3">
          <div className="text-5xl select-none">🚨</div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Something went wrong
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {routeName.charAt(0).toUpperCase() + routeName.slice(1)} ran into an unexpected
            error. You can try again or go back to the home page.
          </p>
        </div>

        {/* Error message pill */}
        <div
          className="rounded-xl px-4 py-3 text-sm font-mono break-all"
          style={{
            background: "#ef444412",
            border: "1px solid #ef444430",
            color: "#ef4444",
          }}
        >
          {error.message || "An unknown error occurred"}
          {error.digest && (
            <span className="block mt-1 text-xs opacity-60">digest: {error.digest}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#3b82f6" }}
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Go home
          </button>
        </div>

        {/* Dev-only stack trace */}
        {isDev && error.stack && (
          <details className="text-xs">
            <summary
              className="cursor-pointer font-medium mb-2 select-none"
              style={{ color: "var(--muted)" }}
            >
              Stack trace
            </summary>
            <pre
              className="overflow-x-auto rounded-lg p-3 leading-relaxed whitespace-pre-wrap"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              {error.stack}
            </pre>
          </details>
        )}

        <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
          If this keeps happening, please contact support with the error details above.
        </p>
      </div>
    </div>
  );
}
