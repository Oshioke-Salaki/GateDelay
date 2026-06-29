"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, ArrowUpRight, AlertCircle, RefreshCw } from "lucide-react";

export type ExecutionStatus = "idle" | "submitting" | "confirming" | "success" | "error";

interface ExecutionProgressProps {
  isOpen: boolean;
  onClose: () => void;
  status: ExecutionStatus;
  hash?: `0x${string}`;
  error?: Error | null;
  onRetry?: () => void;
  side: "YES" | "NO";
  amount: number;
  price: number;
}

export default function ExecutionProgress({
  isOpen,
  onClose,
  status,
  hash,
  error,
  onRetry,
  side,
  amount,
  price,
}: ExecutionProgressProps) {
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Map common blockchain errors to user-friendly messages
  useEffect(() => {
    if (!error) {
      setErrorMessage("");
      return;
    }

    const errMsg = error.message || "";
    if (errMsg.includes("User rejected") || errMsg.includes("UserRejectedRequestError") || errMsg.includes("rejected the request")) {
      setErrorMessage("Transaction was cancelled in your wallet. Please click 'Retry' to sign again.");
    } else if (errMsg.includes("gas required exceeds allowance") || errMsg.includes("out of gas") || errMsg.includes("intrinsic gas too low")) {
      setErrorMessage("Transaction failed due to insufficient gas limit. Please adjust gas or try again.");
    } else if (errMsg.includes("insufficient funds")) {
      setErrorMessage("Insufficient funds in your account to cover the trade amount and network gas fees.");
    } else if (errMsg.includes("reverted") || errMsg.includes("execution reverted")) {
      setErrorMessage("Transaction reverted on-chain. This could be due to slippage tolerance exceeded or market status change.");
    } else if (errMsg.includes("timeout") || errMsg.includes("RPC")) {
      setErrorMessage("Network RPC request timed out. Please check your network connection and retry.");
    } else {
      setErrorMessage(error.message || "An unexpected error occurred during trade execution.");
    }
  }, [error]);

  const shares = amount > 0 ? (amount / price).toFixed(2) : "—";
  const explorerUrl = hash ? `https://etherscan.io/tx/${hash}` : null; // Replace with appropriate chain explorer if needed

  // Step indices
  const getStepIndex = () => {
    switch (status) {
      case "idle":
        return 0;
      case "submitting":
        return 1;
      case "confirming":
        return 2;
      case "success":
        return 3;
      case "error":
        return 2; // Keep at current step but show error state
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="progress-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
            onClick={() => {
              // Block clicking outside if processing to avoid losing context
              if (status !== "submitting" && status !== "confirming") {
                onClose();
              }
            }}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            key="progress-modal"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-labelledby="progress-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            {/* Ambient Background Gradient for Premium feel */}
            <div className="absolute -left-1/4 -top-1/4 -z-10 h-72 w-72 rounded-full bg-purple-500/10 blur-[80px]" />
            <div className="absolute -right-1/4 -bottom-1/4 -z-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[80px]" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 id="progress-modal-title" className="text-lg font-bold tracking-tight">
                {status === "success" && "Trade Executed Successfully"}
                {status === "error" && "Trade Execution Failed"}
                {status === "submitting" && "Confirm in Wallet"}
                {status === "confirming" && "Confirming on Blockchain"}
                {status === "idle" && "Initializing Trade..."}
              </h2>
              {(status === "success" || status === "error") && (
                <button
                  onClick={onClose}
                  aria-label="Close trade progress"
                  className="rounded-full p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  style={{ color: "var(--muted)" }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Order Details Brief */}
            <div className="rounded-2xl border p-4 mb-6 bg-black/5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Order Type</span>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{
                  background: side === "YES" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: side === "YES" ? "#22c55e" : "#ef4444",
                }}>
                  Buy {side}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div>
                  <span style={{ color: "var(--muted)" }}>Amount</span>
                  <p className="font-bold text-sm mt-0.5">{amount.toFixed(2)} USDC</p>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Est. Shares</span>
                  <p className="font-bold text-sm mt-0.5">{shares}</p>
                </div>
              </div>
            </div>

            {/* Step Tracker Visual */}
            <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              
              {/* Step 1: Wallet Submission */}
              <div className="relative">
                {/* Connector Node */}
                <div className={`absolute -left-6 top-1 h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${
                  currentStep > 1
                    ? "bg-emerald-500 text-white"
                    : status === "submitting"
                      ? "bg-purple-600 ring-4 ring-purple-600/20 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800"
                }`}>
                  {currentStep > 1 ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : status === "submitting" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  )}
                </div>
                <div className="pl-2">
                  <h3 className={`text-sm font-semibold transition-colors ${status === "submitting" ? "text-purple-600" : "var(--foreground)"}`}>
                    1. Submit Transaction
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {status === "submitting"
                      ? "Please review details and sign the transaction in your wallet extension."
                      : currentStep > 1
                        ? "Transaction successfully signed and broadcasted."
                        : "Waiting for wallet approval..."}
                  </p>
                </div>
              </div>

              {/* Step 2: Blockchain Confirmation */}
              <div className="relative">
                {/* Connector Node */}
                <div className={`absolute -left-6 top-1 h-4.5 w-4.5 rounded-full flex items-center justify-center transition-all ${
                  status === "success"
                    ? "bg-emerald-500 text-white"
                    : status === "error"
                      ? "bg-rose-500 text-white"
                      : status === "confirming"
                        ? "bg-blue-600 ring-4 ring-blue-600/20 text-white"
                        : "bg-zinc-200 dark:bg-zinc-800"
                }`}>
                  {status === "success" ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : status === "error" ? (
                    <span className="text-[10px] font-bold">✗</span>
                  ) : status === "confirming" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  )}
                </div>
                <div className="pl-2">
                  <h3 className={`text-sm font-semibold transition-colors ${
                    status === "confirming"
                      ? "text-blue-600"
                      : status === "error"
                        ? "text-rose-500"
                        : status === "success"
                          ? "text-emerald-500"
                          : "var(--foreground)"
                  }`}>
                    2. Blockchain Confirmation
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {status === "confirming"
                      ? "Processing on the network. Waiting for block confirmation..."
                      : status === "success"
                        ? "Transaction confirmed on-chain successfully!"
                        : status === "error"
                          ? "Execution stopped due to a transaction error."
                          : "Awaiting broadcast hash..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Error or Success Panel */}
            <div className="mt-8">
              {status === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 text-xs space-y-3"
                >
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Trade Complete</span>
                  </div>
                  <p style={{ color: "var(--muted)" }}>
                    Your order to buy {side} shares has been processed. The shares are now credited to your positions.
                  </p>
                  {hash && (
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-500/10 font-mono text-[10px]">
                      <span className="truncate max-w-[70%] text-zinc-400">{hash}</span>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-emerald-500 hover:underline font-semibold"
                        >
                          View Receipt <ArrowUpRight size={10} />
                        </a>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4 border border-rose-500/20 bg-rose-500/5 text-xs space-y-3"
                >
                  <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                    <AlertCircle size={16} />
                    <span>Transaction Failed</span>
                  </div>
                  <p className="font-medium text-rose-700 dark:text-rose-400">
                    {errorMessage}
                  </p>
                  
                  {/* Retry / Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-rose-500/10">
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors"
                      >
                        <RefreshCw size={12} /> Retry Transaction
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      style={{ color: "var(--foreground)" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
