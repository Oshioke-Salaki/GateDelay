"use client";

import { useWaitForTransactionReceipt, useTransaction, useSendTransaction } from "wagmi";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { TrackedTransaction } from "../../hooks/useTransactionTracker";

interface TransactionItemProps {
  tx: TrackedTransaction;
  onRemove: (hash: `0x${string}`) => void;
}

export function TransactionItem({ tx, onRemove }: TransactionItemProps) {
  // Wait for receipt to determine final success/fail and confirmations
  const { 
    data: receipt, 
    isError: receiptError, 
    isLoading: receiptLoading
  } = useWaitForTransactionReceipt({ 
    hash: tx.hash,
  });

  // Fetch original transaction data to support cancellation (nonce)
  const { data: txData } = useTransaction({ 
    hash: tx.hash 
  });

  const { sendTransaction, isPending: isCancelling } = useSendTransaction();

  // Determine visual status
  let status: "pending" | "success" | "failed" = "pending";
  if (receipt) {
    status = receipt.status === "success" ? "success" : "failed";
  } else if (receiptError) {
    status = "failed";
  }

  const handleCancel = () => {
    if (!txData) return;
    // To cancel: send a 0-value tx to self with the same nonce.
    // Wallet handles the gas price bump requirement for RBF.
    sendTransaction({
      to: txData.from,
      value: 0n,
      data: "0x",
    }, {
      onSuccess: () => {
        // Optionally notify user that cancellation was submitted
      }
    });
  };

  // Status colors
  const statusColors = {
    pending: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    success: "text-green-500 bg-green-500/10 border-green-500/20",
    failed: "text-red-500 bg-red-500/10 border-red-500/20",
  };

  const statusIcons = {
    pending: "⏳",
    success: "✅",
    failed: "❌",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-4 rounded-xl flex flex-col gap-3 transition-all"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{statusIcons[status]}</span>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-[var(--foreground)]">
              {tx.description || "Contract Interaction"}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className={`px-2 py-1 rounded-md text-xs font-medium border ${statusColors[status]} capitalize`}>
          {status}
        </div>
      </div>

      {/* Details Row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)] text-xs">
        <a 
          href={`https://etherscan.io/tx/${tx.hash}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline truncate max-w-[120px]"
          title="View on Explorer"
        >
          {tx.hash.substring(0, 6)}...{tx.hash.substring(tx.hash.length - 4)}
        </a>

        <div className="flex gap-2 items-center">
          {status === "pending" && txData && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ background: "var(--border)", color: "var(--foreground)" }}
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </button>
          )}

          {status !== "pending" && (
            <button
              onClick={() => onRemove(tx.hash)}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Estimated time / Confirmations */}
      {status === "pending" && (
        <div className="w-full h-1 mt-1 bg-[var(--border)] rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-blue-500"
            animate={{ width: ["0%", "100%"] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}
