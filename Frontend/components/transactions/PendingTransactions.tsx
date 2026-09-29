"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, X } from "lucide-react";
import { useTransactionTracker } from "../../hooks/useTransactionTracker";
import { TransactionItem } from "./TransactionItem";

export default function PendingTransactions() {
  const { isConnected } = useAccount();
  const { transactions, removeTransaction } = useTransactionTracker();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {!isConnected ? null : (
        <>
          <AnimatePresence>
            {isOpen && (
              <motion.button
                type="button"
                aria-label="Close transactions drawer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-40 bg-black/35"
              />
            )}
          </AnimatePresence>

          <motion.aside
            initial={false}
            animate={{ x: isOpen ? 0 : "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            role={isOpen ? "dialog" : undefined}
            aria-modal={isOpen || undefined}
            aria-label="Transactions"
            aria-hidden={!isOpen}
            inert={!isOpen}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col shadow-2xl"
            style={{
              background: "var(--card)",
              borderLeft: "1px solid var(--border)",
              visibility: isOpen ? "visible" : "hidden",
              pointerEvents: isOpen ? "auto" : "none",
            }}
          >
            <header className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex min-w-0 items-center gap-3">
                <Activity size={19} aria-hidden="true" style={{ color: "var(--muted)" }} />
                <div>
                  <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>Transactions</h2>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {transactions.length} tracked
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close transactions drawer"
                title="Close"
                className="rounded p-2 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ color: "var(--muted)" }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {transactions.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {transactions.map((tx) => (
                    <TransactionItem key={tx.hash} tx={tx} onRemove={removeTransaction} />
                  ))}
                </AnimatePresence>
              ) : (
                <p className="py-12 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No transactions yet.
                </p>
              )}
            </div>
          </motion.aside>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-expanded={isOpen}
            aria-label={`Open transactions${transactions.length ? `, ${transactions.length} tracked` : ""}`}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            <Activity size={18} aria-hidden="true" />
            Transactions
            {transactions.length > 0 && (
              <span className="min-w-5 rounded-full bg-blue-600 px-1.5 py-0.5 text-center text-xs text-white">
                {transactions.length}
              </span>
            )}
          </button>
        </>
      )}
    </>
  );
}
