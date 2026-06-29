"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useDisconnect } from "@particle-network/connectkit";
import { useToast } from "../../hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalPriority = "standard" | "fast" | "instant";
type WithdrawalStatus = "idle" | "confirming" | "processing" | "success" | "failed";

interface NetworkStatus {
  chainId: number;
  chainName: string;
  healthy: boolean;
  congestionLevel: "low" | "medium" | "high";
  gasPrice: string;
  blockNumber: number;
}

interface EmergencyWithdrawalProps {
  /** Approximate withdrawable balance (display only) */
  balance?: string;
  /** Token symbol */
  tokenSymbol?: string;
  /** Called when withdrawal is confirmed and initiated */
  onWithdraw?: (opts: { amount: string; priority: WithdrawalPriority; address: string }) => Promise<void>;
  /** Network status data (if not provided, mock data is shown) */
  networkStatus?: NetworkStatus;
}

// ─── Mock network status ──────────────────────────────────────────────────────

const MOCK_NETWORK: NetworkStatus = {
  chainId: 5000,
  chainName: "Mantle",
  healthy: true,
  congestionLevel: "low",
  gasPrice: "0.020 Gwei",
  blockNumber: 8_214_932,
};

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: Array<{
  id: WithdrawalPriority;
  label: string;
  description: string;
  estTime: string;
  feeMultiplier: number;
  color: string;
}> = [
  {
    id: "standard",
    label: "Standard",
    description: "Normal queue. Recommended for non-urgent situations.",
    estTime: "10–30 min",
    feeMultiplier: 1,
    color: "#3b82f6",
  },
  {
    id: "fast",
    label: "Fast",
    description: "Priority queue with higher gas. Use when time matters.",
    estTime: "1–5 min",
    feeMultiplier: 1.5,
    color: "#f59e0b",
  },
  {
    id: "instant",
    label: "Instant",
    description: "Highest gas, jumps all queues. Emergency use only.",
    estTime: "< 1 min",
    feeMultiplier: 3,
    color: "#ef4444",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CongestionBadge({ level }: { level: "low" | "medium" | "high" }) {
  const config = {
    low: { label: "Low congestion", color: "#22c55e", bg: "#22c55e20" },
    medium: { label: "Medium congestion", color: "#f59e0b", bg: "#f59e0b20" },
    high: { label: "High congestion", color: "#ef4444", bg: "#ef444420" },
  }[level];

  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: config.bg, color: config.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.color }} />
      {config.label}
    </span>
  );
}

function StatusTracker({ status, priority }: { status: WithdrawalStatus; priority: WithdrawalPriority }) {
  const steps = [
    { id: "confirming", label: "Signature confirmed" },
    { id: "processing", label: "Broadcasting to network" },
    { id: "success", label: "Withdrawal complete" },
  ];

  const activeIdx =
    status === "confirming" ? 0 :
    status === "processing" ? 1 :
    status === "success" ? 2 : -1;

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isDone = activeIdx > i;
        const isActive = activeIdx === i;
        const isFailed = status === "failed" && isActive;

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {isDone && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
              {isActive && !isFailed && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-red-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                </div>
              )}
              {isFailed && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
              {activeIdx < i && !isFailed && (
                <div className="h-7 w-7 rounded-full" style={{ border: "2px solid var(--border)" }} />
              )}
            </div>
            <p className="text-sm font-medium" style={{
              color: isDone ? "#22c55e" : isActive ? (isFailed ? "#ef4444" : "#ef4444") : "var(--muted)",
            }}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmergencyWithdrawal({
  balance = "0.00",
  tokenSymbol = "USDC",
  onWithdraw,
  networkStatus = MOCK_NETWORK,
}: EmergencyWithdrawalProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { success, error: toastError, warning } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [priority, setPriority] = useState<WithdrawalPriority>("standard");
  const [customAddress, setCustomAddress] = useState("");
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");
  const [status, setStatus] = useState<WithdrawalStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const destinationAddress = useCustomAddress ? customAddress : (address ?? "");
  const isAddressValid =
    !useCustomAddress ||
    /^0x[0-9a-fA-F]{40}$/.test(customAddress);
  const CONFIRM_PHRASE = "WITHDRAW";
  const isReadyToSubmit =
    isAddressValid &&
    typedConfirm === CONFIRM_PHRASE &&
    status === "idle";

  const handleOpen = useCallback(() => {
    if (!isConnected) {
      toastError("Not connected", "Connect your wallet before using emergency withdrawal.");
      return;
    }
    if (networkStatus.congestionLevel === "high") {
      warning(
        "High network congestion",
        "Gas fees are elevated. Consider waiting or using Instant priority.",
      );
    }
    setShowModal(true);
    setStatus("idle");
    setTypedConfirm("");
    setTxHash(null);
  }, [isConnected, networkStatus.congestionLevel, toastError, warning]);

  const handleClose = useCallback(() => {
    if (status === "processing") return; // block close while processing
    setShowModal(false);
    setStatus("idle");
    setTypedConfirm("");
    setTxHash(null);
  }, [status]);

  const handleConfirm = useCallback(async () => {
    if (!isReadyToSubmit || !destinationAddress) return;

    setStatus("confirming");

    try {
      // Step 1: simulate signature confirmation
      await new Promise<void>((res) => setTimeout(res, 800));
      setStatus("processing");

      // Step 2: call provided handler or simulate
      if (onWithdraw) {
        await onWithdraw({ amount: balance, priority, address: destinationAddress });
      } else {
        await new Promise<void>((res) => setTimeout(res, 2000));
      }

      const mockHash = "0x" + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      setTxHash(mockHash);
      setStatus("success");
      success(
        "Emergency withdrawal initiated",
        `${balance} ${tokenSymbol} queued with ${priority} priority.`,
      );
    } catch (err) {
      setStatus("failed");
      toastError(
        "Withdrawal failed",
        (err as Error)?.message ?? "Transaction could not be submitted.",
      );
    }
  }, [
    isReadyToSubmit, destinationAddress, balance, priority,
    tokenSymbol, onWithdraw, success, toastError,
  ]);

  const selectedPriorityConfig = PRIORITY_OPTIONS.find((p) => p.id === priority)!;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all hover:opacity-90 active:scale-[0.99]"
        style={{
          background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
          border: "1px solid #b91c1c",
        }}
        aria-label="Open emergency withdrawal panel"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-5 w-5 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-100">Emergency Withdrawal</p>
            <p className="text-xs text-red-300">Withdraw funds immediately in urgent situations</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-red-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={handleClose}
              aria-hidden="true"
            />

            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="emergency-title"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl shadow-2xl"
              style={{ background: "var(--card)", border: "1px solid #b91c1c" }}
            >
              {/* Red header bar */}
              <div className="px-6 py-4" style={{ background: "linear-gradient(135deg, #7f1d1d, #991b1b)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/30">
                      <svg className="h-5 w-5 text-red-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h2 id="emergency-title" className="text-base font-bold text-red-100">Emergency Withdrawal</h2>
                      <p className="text-xs text-red-300">This action is immediate and irreversible</p>
                    </div>
                  </div>
                  {status !== "processing" && (
                    <button
                      onClick={handleClose}
                      aria-label="Close"
                      className="rounded-full p-1.5 text-red-300 transition-opacity hover:opacity-70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                {/* Success state */}
                {status === "success" && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                        <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Withdrawal submitted</p>
                      <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
                        {balance} {tokenSymbol} queued with <strong className="capitalize">{priority}</strong> priority.
                      </p>
                    </div>
                    {txHash && (
                      <div className="rounded-xl p-3 text-xs" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <p className="font-medium mb-1" style={{ color: "var(--muted)" }}>Transaction hash</p>
                        <p className="font-mono break-all" style={{ color: "var(--foreground)" }}>{txHash}</p>
                      </div>
                    )}
                    <button
                      onClick={handleClose}
                      className="w-full rounded-xl py-3 text-sm font-semibold text-white"
                      style={{ background: "#22c55e" }}
                    >
                      Done
                    </button>
                  </motion.div>
                )}

                {/* Processing state */}
                {(status === "confirming" || status === "processing") && (
                  <div className="space-y-4 py-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Processing withdrawal…</p>
                    <StatusTracker status={status} priority={priority} />
                    <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                      Do not close this window.
                    </p>
                  </div>
                )}

                {/* Failed state */}
                {status === "failed" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-red-300/50 bg-red-50 p-4 text-sm dark:bg-red-950/30">
                      <p className="font-semibold text-red-700 dark:text-red-300">Withdrawal failed</p>
                      <p className="mt-1 text-red-600 dark:text-red-400">The transaction could not be submitted. Your funds are safe.</p>
                    </div>
                    <button
                      onClick={() => { setStatus("idle"); setTypedConfirm(""); }}
                      className="w-full rounded-xl py-3 text-sm font-semibold text-white"
                      style={{ background: "#ef4444" }}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {/* Idle — form */}
                {status === "idle" && (
                  <>
                    {/* Network status */}
                    <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                          Network status
                        </p>
                        <CongestionBadge level={networkStatus.congestionLevel} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          { label: "Network", value: networkStatus.chainName },
                          { label: "Gas price", value: networkStatus.gasPrice },
                          { label: "Block", value: networkStatus.blockNumber.toLocaleString() },
                        ].map((item) => (
                          <div key={item.label}>
                            <p style={{ color: "var(--muted)" }}>{item.label}</p>
                            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${networkStatus.healthy ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {networkStatus.healthy ? "Network healthy" : "Network degraded — proceed with caution"}
                        </span>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="rounded-xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>Available to withdraw</p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                        {balance} <span className="text-base">{tokenSymbol}</span>
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>Full balance will be withdrawn</p>
                    </div>

                    {/* Priority selector */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                        Withdrawal priority
                      </p>
                      <div className="space-y-2">
                        {PRIORITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPriority(opt.id)}
                            className="w-full rounded-xl p-3 text-left transition-all"
                            style={{
                              background: priority === opt.id ? `${opt.color}15` : "var(--background)",
                              border: `1.5px solid ${priority === opt.id ? opt.color : "var(--border)"}`,
                            }}
                            aria-pressed={priority === opt.id}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: opt.color }} aria-hidden="true" />
                                <span className="text-sm font-semibold" style={{ color: priority === opt.id ? opt.color : "var(--foreground)" }}>
                                  {opt.label}
                                </span>
                              </div>
                              <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{opt.estTime}</span>
                            </div>
                            <p className="mt-1 ml-4.5 text-xs" style={{ color: "var(--muted)" }}>{opt.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom recipient */}
                    <div>
                      <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                        <input type="checkbox" checked={useCustomAddress} onChange={(e) => { setUseCustomAddress(e.target.checked); setCustomAddress(""); }} className="h-4 w-4 rounded" />
                        Send to a different address
                      </label>
                      <AnimatePresence>
                        {useCustomAddress && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <input
                              type="text"
                              placeholder="0x… recipient address"
                              value={customAddress}
                              onChange={(e) => setCustomAddress(e.target.value)}
                              className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                              style={{
                                background: "var(--background)",
                                border: `1px solid ${isAddressValid ? "var(--border)" : "#ef4444"}`,
                                color: "var(--foreground)",
                              }}
                              aria-label="Custom recipient address"
                            />
                            {!isAddressValid && customAddress && (
                              <p className="mt-1 text-xs text-red-500">Invalid Ethereum address</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Destination preview */}
                    {destinationAddress && (
                      <div className="rounded-xl p-3 text-xs" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--muted)" }}>Destination: </span>
                        <span className="font-mono" style={{ color: "var(--foreground)" }}>
                          {destinationAddress.slice(0, 10)}…{destinationAddress.slice(-8)}
                        </span>
                      </div>
                    )}

                    {/* Confirmation phrase */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                        Type <strong className="text-red-500">{CONFIRM_PHRASE}</strong> to confirm
                      </label>
                      <input
                        type="text"
                        value={typedConfirm}
                        onChange={(e) => setTypedConfirm(e.target.value.toUpperCase())}
                        placeholder={CONFIRM_PHRASE}
                        className="w-full rounded-xl px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
                        style={{
                          background: "var(--background)",
                          border: `1.5px solid ${typedConfirm === CONFIRM_PHRASE ? "#22c55e" : "var(--border)"}`,
                          color: "var(--foreground)",
                        }}
                        aria-label={`Type ${CONFIRM_PHRASE} to confirm emergency withdrawal`}
                        maxLength={10}
                      />
                    </div>

                    {/* Warning */}
                    <div className="rounded-xl border border-red-300/40 bg-red-50 p-3 text-xs dark:bg-red-950/25">
                      <p className="font-semibold text-red-700 dark:text-red-300">⚠ This action is irreversible</p>
                      <p className="mt-1 text-red-600 dark:text-red-400">
                        Emergency withdrawals bypass normal processing queues. Verify the destination address carefully before confirming.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                        style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isReadyToSubmit}
                        className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: selectedPriorityConfig.color }}
                      >
                        Withdraw now
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
