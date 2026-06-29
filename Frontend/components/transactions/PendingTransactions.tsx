"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";
import { useTransactionTracker } from "../../hooks/useTransactionTracker";
import { TransactionItem } from "./TransactionItem";

export default function PendingTransactions() {
  const { isConnected } = useAccount();
  const { transactions, removeTransaction, clearTransactions } = useTransactionTracker();
  const [isOpen, setIsOpen] = useState(false);

  // If wallet is not connected or no transactions exist, render nothing or a compact button.
  if (!isConnected) {
    return null;
  }

  const pendingCount = transactions.filter(t => {
    // Just a rough estimate for button badge. Real status is inside TransactionItem.
    // For a highly accurate badge, we'd need to lift status up, but this suffices for UX.
    return true; // We'll show the total tracked for now.
  }).length;

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.02)" }}>
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Recent Transactions
              </h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={clearTransactions}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {transactions.map((tx) => (
                  <TransactionItem 
                    key={tx.hash} 
                    tx={tx} 
                    onRemove={removeTransaction}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-medium text-sm transition-colors text-white"
        style={{ 
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <span className="text-lg">⚡</span>
        {pendingCount} Transaction{pendingCount !== 1 ? "s" : ""}
      </motion.button>
    </div>
  );
}
