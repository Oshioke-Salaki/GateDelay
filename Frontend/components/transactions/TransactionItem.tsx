"use client";

import { useEffect, useState } from "react";
import { useAccount, useBlockNumber, usePublicClient, useWaitForTransactionReceipt, useTransaction, useSendTransaction } from "wagmi";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { TrackedTransaction, useTrackTransaction } from "../../hooks/useTransactionTracker";
import { explorerTxUrl } from "../../lib/txUtils";

interface TransactionItemProps {
  tx: TrackedTransaction;
  onRemove: (hash: `0x${string}`) => void;
}

export function TransactionItem({ tx, onRemove }: TransactionItemProps) {
  const { chainId: connectedChainId } = useAccount();
  const chainId = tx.chainId ?? connectedChainId;
  const { 
    data: receipt, 
    isError: receiptError, 
  } = useWaitForTransactionReceipt({
    hash: tx.hash,
    chainId,
  });
  const { data: txData } = useTransaction({
    hash: tx.hash,
    chainId,
  });
  const { data: cancellationHash, sendTransaction, isPending: isCancelling } = useSendTransaction();
  useTrackTransaction(cancellationHash, "Transaction cancellation");
  const { data: blockNumber } = useBlockNumber({
    chainId,
    watch: true,
    query: { enabled: Boolean(receipt) },
  });
  const publicClient = usePublicClient({ chainId });
  const [failureDetails, setFailureDetails] = useState<{ hash: string; reason: string } | null>(null);

  useEffect(() => {
    const receiptBlockNumber = receipt?.blockNumber;
    if (receipt?.status !== "reverted" || receiptBlockNumber === undefined) return;

    const revertBlockNumber = receiptBlockNumber > 0n ? receiptBlockNumber - 1n : undefined;
    let cancelled = false;

    async function readFailureReason() {
      if (!txData?.to || !publicClient) {
        setFailureDetails({ hash: tx.hash, reason: "Transaction reverted during contract execution." });
        return;
      }
      try {
        await publicClient.call({
          account: txData.from,
          to: txData.to,
          data: txData.input,
          value: txData.value,
          blockNumber: revertBlockNumber,
        });
        if (!cancelled) {
          setFailureDetails({
            hash: tx.hash,
            reason: "Transaction reverted; the network did not return a reason.",
          });
        }
      } catch (error) {
        const candidate = error as { shortMessage?: string; message?: string };
        const reason = candidate.shortMessage ?? candidate.message;
        if (!cancelled && reason) {
          setFailureDetails({ hash: tx.hash, reason: reason.replace(/\s+/g, " ").slice(0, 240) });
        }
      }
    }

    void readFailureReason();
    return () => {
      cancelled = true;
    };
  }, [publicClient, receipt, tx.hash, txData]);

  // Determine visual status
  let status: "pending" | "confirmed" | "failed" = "pending";
  if (receipt) {
    status = receipt.status === "success" ? "confirmed" : "failed";
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
    confirmed: "text-green-500 bg-green-500/10 border-green-500/20",
    failed: "text-red-500 bg-red-500/10 border-red-500/20",
  };

  const statusIcons = {
    pending: "⏳",
    confirmed: "✓",
    failed: "❌",
  };

  const confirmations = receipt && blockNumber && blockNumber >= receipt.blockNumber
    ? Number(blockNumber - receipt.blockNumber + 1n)
    : receipt ? 1 : 0;
  const failureReason = failureDetails?.hash === tx.hash
    ? failureDetails.reason
    : "Transaction reverted during contract execution.";

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
          {status === "confirmed" ? "Confirmed" : status}
        </div>
      </div>

      {/* Details Row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)] text-xs">
        <a 
          href={explorerTxUrl(tx.hash)}
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

      {status === "pending" && (
        <p className="text-xs text-[var(--muted)]" role={receiptError ? "status" : undefined}>
          {receiptError ? "Receipt lookup unavailable; checking again." : "Waiting for confirmation"}
        </p>
      )}
      {receipt && status === "confirmed" && (
        <p className="text-xs text-[var(--muted)]">
          {confirmations} confirmation{confirmations === 1 ? "" : "s"} · Block {receipt.blockNumber.toString()}
        </p>
      )}
      {status === "failed" && (
        <div className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600" role="status">
          <span className="font-semibold">Failure reason: </span>
          {failureReason || "Transaction reverted during contract execution."}
        </div>
      )}
    </motion.div>
  );
}
