"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@particle-network/connectkit";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "wallet_backup_status";

type BackupStatus = "pending" | "dismissed" | "completed";

/**
 * Reads the backup status from localStorage.
 * Safe to call only on the client (inside useEffect or event handlers).
 */
function readStatus(): BackupStatus {
  return (localStorage.getItem(STORAGE_KEY) as BackupStatus) ?? "pending";
}

function writeStatus(status: BackupStatus): void {
  localStorage.setItem(STORAGE_KEY, status);
}

/**
 * BackupReminder
 *
 * SSR notes
 * ---------
 * This component is a Client Component ("use client") rendered inside Next.js
 * App Router. Two SSR hazards are guarded against here:
 *
 * 1. localStorage is not available on the server.  We never access it outside
 *    of useEffect / event handlers, so there is no server-side reference.
 *
 * 2. Hydration mismatch from wallet state.  `useAccount()` from Particle
 *    Network returns `isConnected: false` during SSR / the initial hydration
 *    render; the real value is only known after the client hydrates.  If we
 *    initialised `visible` from `isConnected` synchronously we would get a
 *    server/client mismatch warning.
 *
 *    Solution: use a `mounted` flag.  The component renders nothing (null) on
 *    the first pass — matching the server output — and only reads
 *    localStorage + wallet state after `useEffect` confirms we are on the
 *    client.  This eliminates both the hydration warning and the brief flicker
 *    where a dismissed banner re-appears before the effect runs.
 *
 * Phase 2+ dependency
 * -------------------
 * If Particle Network ever exposes a server-safe wallet context (e.g. via
 * cookie-persisted session), the `mounted` guard can be removed and the
 * initial state derived server-side instead.
 */
export default function BackupReminder() {
  const { isConnected } = useAccount();

  // `mounted` is false on the server and on the very first client render,
  // ensuring the hydrated markup matches the server-rendered markup (both
  // produce null / nothing visible).
  const [mounted, setMounted] = useState(false);
  const [status, setLocalStatus] = useState<BackupStatus>("pending");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Runs only on the client, after hydration is complete.
    setMounted(true);
    const s = readStatus();
    setLocalStatus(s);
    setVisible(isConnected && s === "pending");
  }, [isConnected]);

  // Re-evaluate visibility whenever the connection state changes after mount.
  useEffect(() => {
    if (!mounted) return;
    setVisible(isConnected && status === "pending");
  }, [isConnected, mounted, status]);

  const dismiss = () => {
    writeStatus("dismissed");
    setLocalStatus("dismissed");
    setVisible(false);
  };

  const markCompleted = () => {
    writeStatus("completed");
    setLocalStatus("completed");
    setVisible(false);
  };

  // Render nothing until the client has hydrated.  This guarantees the
  // server-rendered HTML and the initial client render are identical, avoiding
  // React hydration warnings.
  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          {/* Icon */}
          <span className="text-xl shrink-0" aria-hidden="true">🔐</span>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Back up your wallet</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Save your seed phrase somewhere safe. Without it you cannot
              recover your wallet.{" "}
              <a
                href="https://support.metamask.io/managing-my-wallet/secret-recovery-phrase-and-private-keys/how-to-reveal-your-secret-recovery-phrase/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
                style={{ color: "var(--foreground)" }}
              >
                How to back up →
              </a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={markCompleted}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#3b82f6" }}
            >
              Done
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss backup reminder"
              className="rounded-lg p-1.5 transition-colors hover:opacity-70"
              style={{ color: "var(--muted)" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
