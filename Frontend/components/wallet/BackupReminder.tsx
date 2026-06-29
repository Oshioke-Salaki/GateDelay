"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@particle-network/connectkit";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "wallet_backup_status";

type BackupStatus = "pending" | "dismissed" | "completed";

function getStatus(): BackupStatus {
  if (typeof window === "undefined") return "pending";
  return (localStorage.getItem(STORAGE_KEY) as BackupStatus) ?? "pending";
}

function setStatus(status: BackupStatus) {
  localStorage.setItem(STORAGE_KEY, status);
}

export default function BackupReminder() {
  const { isConnected } = useAccount();
  const [status, setLocalStatus] = useState<BackupStatus>("pending");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const s = getStatus();
    setLocalStatus(s);
    setVisible(isConnected && s === "pending");
  }, [isConnected]);

  const dismiss = () => {
    setStatus("dismissed");
    setLocalStatus("dismissed");
    setVisible(false);
  };

  const markCompleted = () => {
    setStatus("completed");
    setLocalStatus("completed");
    setVisible(false);
  };

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
              Save your seed phrase somewhere safe. Without it you cannot recover your wallet.{" "}
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
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
