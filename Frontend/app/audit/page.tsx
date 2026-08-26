"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { Shield, Info } from "lucide-react";
import AuditLogViewer from "../../components/audit/AuditLogViewer";

/**
 * Market audit route (`/audit`).
 *
 * Shell contract: `app/layout.tsx` supplies the navbar, theme, toasts and the
 * app-wide `QueryProvider`. This page owns only the page-level container, so it
 * starts at `<main>` and never repeats chrome.
 *
 * Responsive rules used here, mirrored inside `AuditLogViewer`:
 *  - the container gutter steps 16px -> 24px -> 32px rather than sitting at a
 *    fixed `px-4`, so the log table is not pinned to the viewport edge on
 *    tablets and up;
 *  - `min-w-0` on the flex/grid children lets the table's own
 *    `overflow-x-auto` engage. Without it a wide table forces the *page* to
 *    scroll sideways, which is the layout bug this route had;
 *  - stat cards step 1 -> 2 -> 4 columns; jumping straight from 1 to 4 at `md`
 *    squeezed the four cards into ~180px each on tablet.
 */

function AuditSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      {/* Stats cards skeleton — matches the real grid's breakpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 h-24"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
        ))}
      </div>
      {/* Filters skeleton */}
      <div
        className="rounded-2xl p-5 h-32"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      />
      {/* Table skeleton */}
      <div
        className="rounded-2xl h-96"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      />
    </div>
  );
}

export default function AuditPage() {
  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl p-2.5 shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))",
              border: "1px solid rgba(59,130,246,0.25)",
            }}
          >
            <Shield size={20} className="text-blue-500" />
          </div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight text-balance"
            style={{ color: "var(--foreground)" }}
          >
            Market Audit Log
          </h1>
        </div>
        <p className="text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
          Inspect the history of all market actions, administrative updates, and risk parameters.
          Every record is cryptographically linked to ensure complete tampering protection.
        </p>

        {/* Info banner */}
        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(59,130,246,0.05)",
            border: "1px solid rgba(59,130,246,0.15)",
            color: "var(--muted)",
          }}
        >
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: "#3b82f6" }} />
          <span className="min-w-0">
            The audit chain links each operation to its predecessor using SHA-256 hashes.
            Any modification to existing logs will immediately break the validation chain.
            Export the logs as a CSV for external compliance reviews.
          </span>
        </div>
      </motion.div>

      {/* Main audit log viewer. `min-w-0` keeps the wide table scrolling inside
          its own container instead of widening the page. */}
      <section aria-label="Market audit log records" className="min-w-0">
        <Suspense fallback={<AuditSkeleton />}>
          <AuditLogViewer />
        </Suspense>
      </section>
    </main>
  );
}
