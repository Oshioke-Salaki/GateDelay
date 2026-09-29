"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccount, useTransactionCount, usePublicClient } from "wagmi";
import { useTransactionTracker } from "../../hooks/useTransactionTracker";
import { motion, AnimatePresence } from "framer-motion";
import {
  Info,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle,
  ShieldAlert,
  Settings,
  HelpCircle
} from "lucide-react";

export interface NonceManagementProps {
  /** Callback fired whenever the current active nonce changes */
  onNonceChange?: (nonce: number) => void;
  /** Optional initial override value */
  initialCustomNonce?: number;
}

export default function NonceManagement({
  onNonceChange,
  initialCustomNonce
}: NonceManagementProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { transactions } = useTransactionTracker();

  // ─── Query Nonces ──────────────────────────────────────────────────────────

  // Pending transaction count represents the next expected nonce including pending ones
  const {
    data: pendingNonceData,
    refetch: refetchPending,
    isFetching: isFetchingPending
  } = useTransactionCount({
    address,
    blockTag: "pending",
    query: {
      enabled: !!address,
    }
  });

  // Latest transaction count represents the last confirmed network nonce
  const {
    data: latestNonceData,
    refetch: refetchLatest,
    isFetching: isFetchingLatest
  } = useTransactionCount({
    address,
    blockTag: "latest",
    query: {
      enabled: !!address,
    }
  });

  const pendingNonce = pendingNonceData !== undefined ? Number(pendingNonceData) : 0;
  const latestNonce = latestNonceData !== undefined ? Number(latestNonceData) : 0;

  // ─── Local State ────────────────────────────────────────────────────────────

  const [customNonce, setCustomNonce] = useState<number | null>(
    initialCustomNonce !== undefined ? initialCustomNonce : null
  );
  const [showTooltip, setShowTooltip] = useState(false);
  const [pendingTxsNonces, setPendingTxsNonces] = useState<Record<string, number>>({});
  const [isFetchingTrackerNonces, setIsFetchingTrackerNonces] = useState(false);

  // ─── Fetch Nonces for Tracked Pending Transactions ─────────────────────────

  useEffect(() => {
    async function fetchTrackerNonces() {
      if (!publicClient || !transactions.length || !address) {
        setPendingTxsNonces({});
        return;
      }
      setIsFetchingTrackerNonces(true);
      const noncesMap: Record<string, number> = {};
      for (const tx of transactions) {
        try {
          const txData = await publicClient.getTransaction({ hash: tx.hash });
          if (txData && txData.nonce !== undefined && txData.from.toLowerCase() === address.toLowerCase()) {
            noncesMap[tx.hash] = Number(txData.nonce);
          }
        } catch (err) {
          console.error("Error fetching nonce for tx:", tx.hash, err);
        }
      }
      setPendingTxsNonces(noncesMap);
      setIsFetchingTrackerNonces(false);
    }
    fetchTrackerNonces();
  }, [transactions, publicClient, address]);

  // Reset custom nonce if address changes
  useEffect(() => {
    setCustomNonce(null);
  }, [address]);

  // Compute actual nonce used (custom override or pending nonce)
  const effectiveNonce = customNonce !== null ? customNonce : pendingNonce;

  // Trigger onNonceChange callback when effective nonce changes
  useEffect(() => {
    if (onNonceChange && isConnected && address) {
      onNonceChange(effectiveNonce);
    }
  }, [effectiveNonce, onNonceChange, isConnected, address]);

  // ─── Validation & Warning Logic ─────────────────────────────────────────────

  const isLowerThanConfirmed = customNonce !== null && customNonce < latestNonce;
  const isGapped = customNonce !== null && customNonce > pendingNonce + 1;
  const hasConflict = customNonce !== null && Object.values(pendingTxsNonces).includes(customNonce);

  // Find the description of conflicting tx if any
  const conflictingTxDesc = hasConflict
    ? transactions.find(tx => pendingTxsNonces[tx.hash] === customNonce)?.description || "Active transaction"
    : "";

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleIncrement = () => {
    const current = customNonce !== null ? customNonce : pendingNonce;
    setCustomNonce(current + 1);
  };

  const handleDecrement = () => {
    const current = customNonce !== null ? customNonce : pendingNonce;
    if (current > latestNonce) {
      setCustomNonce(current - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setCustomNonce(null);
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setCustomNonce(parsed);
    }
  };

  const handleReset = () => {
    setCustomNonce(null);
    refetchPending();
    refetchLatest();
  };

  if (!isConnected || !address) {
    return (
      <div
        className="rounded-2xl p-4 text-xs text-center border"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}
      >
        <p>Connect your wallet to manage transaction nonces.</p>
      </div>
    );
  }

  const isSyncing = isFetchingPending || isFetchingLatest || isFetchingTrackerNonces;

  return (
    <div
      className="rounded-3xl p-5 shadow-lg relative overflow-hidden border transition-all duration-300"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--foreground)"
      }}
    >
      {/* Background soft gradients */}
      <div className="absolute -right-20 -top-20 -z-10 w-40 h-40 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 -z-10 w-40 h-40 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-1.5 bg-violet-500/10 text-violet-500">
            <Settings size={16} />
          </div>
          <div>
            <h4 className="font-bold text-xs leading-tight">Nonce Management</h4>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>Customize transaction execution order</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="What is a nonce?"
            aria-label="What is a nonce?"
          >
            <HelpCircle size={14} style={{ color: "var(--muted)" }} />
          </button>
          <button
            onClick={handleReset}
            disabled={isSyncing}
            className={`p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isSyncing ? "animate-spin" : ""}`}
            title="Sync with Network State"
            aria-label="Sync with Network State"
          >
            <RefreshCw size={14} style={{ color: "var(--muted)" }} />
          </button>
        </div>
      </div>

      {/* Info Tooltip Section */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-3 rounded-xl text-[11px] leading-relaxed space-y-2 border" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--muted)" }}>
              <p>
                <strong>What is a Nonce?</strong> A nonce is a sequential number assigned to every transaction sent from your address. It ensures transactions are processed in the exact order they are signed, and prevents double-spending.
              </p>
              <p>
                <strong>Why customize?</strong> If a transaction is stuck with low gas, you can overwrite it by sending a new transaction with the <em>same nonce</em> and a higher gas fee. Setting a <em>gapped nonce</em> (higher than pending + 1) will pause execution until the missing nonces are filled.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nonce Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-2xl border text-center" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--muted)" }}>
            Confirmed Nonce
          </span>
          <div className="text-lg font-bold font-mono mt-0.5">
            {latestNonce}
          </div>
          <p className="text-[9px]" style={{ color: "var(--muted)" }}>Last finalized block</p>
        </div>

        <div className="p-3 rounded-2xl border text-center" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--muted)" }}>
            Pending Nonce
          </span>
          <div className="text-lg font-bold font-mono mt-0.5 flex items-center justify-center gap-1">
            {pendingNonce}
            {isSyncing && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />}
          </div>
          <p className="text-[9px]" style={{ color: "var(--muted)" }}>Next expected queue nonce</p>
        </div>
      </div>

      {/* Custom Nonce Selection Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--muted)" }}>
            Selected Custom Nonce
          </label>
          {customNonce !== null && (
            <span className="text-[10px] font-bold text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/15">
              Custom Overridden
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          {/* Stepper Decrement */}
          <button
            type="button"
            onClick={handleDecrement}
            disabled={effectiveNonce <= latestNonce}
            className="p-2.5 rounded-xl border flex items-center justify-center transition-all disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
            aria-label="Decrement Nonce"
          >
            <Minus size={14} />
          </button>

          {/* Number Input */}
          <div className="relative flex-1">
            <input
              type="number"
              min={latestNonce}
              value={customNonce !== null ? customNonce : ""}
              onChange={handleInputChange}
              placeholder={pendingNonce.toString()}
              className={`w-full rounded-xl px-3 py-2 text-center text-sm font-semibold font-mono border focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all ${
                customNonce !== null ? "text-violet-500 font-bold" : "text-[var(--foreground)]"
              }`}
              style={{
                background: "var(--background)",
                borderColor: customNonce !== null ? "var(--border)" : "var(--border)"
              }}
              aria-label="Custom Nonce Value"
            />
          </div>

          {/* Stepper Increment */}
          <button
            type="button"
            onClick={handleIncrement}
            className="p-2.5 rounded-xl border flex items-center justify-center transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
            aria-label="Increment Nonce"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Validation and Conflict Notifications */}
        <AnimatePresence mode="wait">
          {isLowerThanConfirmed && (
            <motion.div
              key="lower-confirmed-warning"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 flex gap-2 items-start text-[10px]"
            >
              <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Invalid Nonce:</span> Value cannot be lower than the confirmed network nonce ({latestNonce}). Transactions with this nonce will automatically fail.
              </div>
            </motion.div>
          )}

          {!isLowerThanConfirmed && hasConflict && (
            <motion.div
              key="conflict-warning"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 flex gap-2 items-start text-[10px]"
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Nonce Conflict:</span> This nonce matches an active transaction: <em className="underline">"{conflictingTxDesc}"</em>. Sending this transaction will attempt to cancel or replace it.
              </div>
            </motion.div>
          )}

          {!isLowerThanConfirmed && !hasConflict && isGapped && (
            <motion.div
              key="gapped-warning"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 flex gap-2 items-start text-[10px]"
            >
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Gapped Nonce Warning:</span> Setting a nonce higher than pending nonce + 1 ({pendingNonce + 1}) will pause execution. This transaction will remain pending until all prior nonces are filled.
              </div>
            </motion.div>
          )}

          {!isLowerThanConfirmed && !hasConflict && !isGapped && customNonce !== null && (
            <motion.div
              key="valid-override-info"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="p-2.5 rounded-xl border border-green-500/20 bg-green-500/5 text-green-500 flex gap-2 items-start text-[10px]"
            >
              <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Custom Nonce Valid:</span> Transaction will be submitted with custom nonce override <span className="font-mono font-bold">{customNonce}</span>.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset / Default Action Options */}
        {customNonce !== null && (
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2.5 rounded-xl text-xs font-bold transition-all border hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)]"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            Reset to Default / Network Nonce
          </button>
        )}
      </div>
    </div>
  );
}
