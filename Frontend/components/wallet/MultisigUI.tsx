"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  PenLine,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import type { MultisigTransaction, MultisigWallet } from "@/lib/multisigStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MultisigUIProps {
  walletId?: string;
  currentOwner?: string;
}

interface ProposeForm {
  target: string;
  value: string;
  data: string;
}

interface SignForm {
  signature: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchWallet(walletId: string): Promise<MultisigWallet> {
  const res = await fetch(`/api/multisig/wallet/${walletId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load wallet");
  return json.data;
}

async function fetchTxStatus(txId: string): Promise<MultisigTransaction> {
  const res = await fetch(`/api/multisig/status/${txId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load transaction");
  return json.data;
}

async function proposeTx(payload: {
  walletId: string;
  txData: Record<string, string>;
  proposer: string;
}): Promise<string> {
  const res = await fetch("/api/multisig/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to propose transaction");
  return json.data.txId;
}

async function signTx(payload: {
  txId: string;
  owner: string;
  signature: string;
}): Promise<MultisigTransaction> {
  const res = await fetch("/api/multisig/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to submit signature");
  return json.data;
}

async function executeTx(txId: string): Promise<MultisigTransaction> {
  const res = await fetch("/api/multisig/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to execute transaction");
  return json.data;
}

const STATUS_COLORS: Record<MultisigTransaction["status"], string> = {
  Pending: "#f59e0b",
  Ready: "#3b82f6",
  Executed: "#22c55e",
};

const WALLET_OPTIONS = [
  { id: "MARKET_OPS", label: "Market Operations" },
  { id: "TREASURY", label: "Treasury" },
];

// ─── MultisigUI ───────────────────────────────────────────────────────────────

export default function MultisigUI({
  walletId: initialWalletId = "MARKET_OPS",
  currentOwner = "0xOwner1...",
}: MultisigUIProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedWallet, setSelectedWallet] = useState(initialWalletId);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);

  const {
    register: registerPropose,
    handleSubmit: handleProposeSubmit,
    reset: resetPropose,
    formState: { errors: proposeErrors },
  } = useForm<ProposeForm>({
    defaultValues: { target: "", value: "0", data: "0x" },
  });

  const {
    register: registerSign,
    handleSubmit: handleSignSubmit,
    reset: resetSign,
    formState: { errors: signErrors },
  } = useForm<SignForm>({
    defaultValues: { signature: "" },
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["multisig-wallet", selectedWallet],
    queryFn: () => fetchWallet(selectedWallet),
  });

  const { data: txStatus, isLoading: txLoading } = useQuery({
    queryKey: ["multisig-tx", activeTxId],
    queryFn: () => fetchTxStatus(activeTxId!),
    enabled: !!activeTxId,
    refetchInterval: activeTxId ? 3000 : false,
  });

  const proposeMutation = useMutation({
    mutationFn: proposeTx,
    onSuccess: (txId) => {
      setActiveTxId(txId);
      resetPropose();
      toast.success("Transaction Proposed", `Transaction ${txId.slice(0, 12)}… created`);
      queryClient.invalidateQueries({ queryKey: ["multisig-tx", txId] });
    },
    onError: (err: Error) => toast.error("Proposal Failed", err.message),
  });

  const signMutation = useMutation({
    mutationFn: signTx,
    onSuccess: (tx) => {
      resetSign();
      toast.success("Signature Submitted", `${tx.signatures.length} signature(s) collected`);
      queryClient.invalidateQueries({ queryKey: ["multisig-tx", tx.id] });
    },
    onError: (err: Error) => toast.error("Signature Failed", err.message),
  });

  const executeMutation = useMutation({
    mutationFn: executeTx,
    onSuccess: (tx) => {
      toast.success("Transaction Executed", `Hash: ${tx.txHash?.slice(0, 14)}…`);
      queryClient.invalidateQueries({ queryKey: ["multisig-tx", tx.id] });
    },
    onError: (err: Error) => toast.error("Execution Failed", err.message),
  });

  const onPropose = useCallback(
    (data: ProposeForm) => {
      proposeMutation.mutate({
        walletId: selectedWallet,
        txData: { target: data.target, value: data.value, data: data.data },
        proposer: currentOwner,
      });
    },
    [proposeMutation, selectedWallet, currentOwner]
  );

  const onSign = useCallback(
    (data: SignForm) => {
      if (!activeTxId) return;
      signMutation.mutate({ txId: activeTxId, owner: currentOwner, signature: data.signature });
    },
    [signMutation, activeTxId, currentOwner]
  );

  const signatureProgress = wallet && txStatus
    ? Math.min((txStatus.signatures.length / wallet.threshold) * 100, 100)
    : 0;

  const hasSigned = txStatus?.signatures.some((s) => s.owner === currentOwner) ?? false;

  return (
    <div
      className="rounded-2xl p-6 space-y-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl"
          style={{ background: "rgba(59, 130, 246, 0.12)" }}
        >
          <Shield className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Multisig Wallet
          </h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Manage market multisig operations and signatures
          </p>
        </div>
      </div>

      {/* Wallet selector */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted)" }}>
          Select Wallet
        </label>
        <div className="flex gap-2">
          {WALLET_OPTIONS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setSelectedWallet(w.id);
                setActiveTxId(null);
              }}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: selectedWallet === w.id ? "rgba(59, 130, 246, 0.15)" : "var(--background)",
                border: `1px solid ${selectedWallet === w.id ? "#3b82f6" : "var(--border)"}`,
                color: selectedWallet === w.id ? "#3b82f6" : "var(--foreground)",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet status */}
      {walletLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : wallet ? (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Wallet Status
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(34, 197, 94, 0.12)", color: "#22c55e" }}
            >
              Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Address</p>
              <p className="font-mono text-xs truncate" style={{ color: "var(--foreground)" }}>
                {wallet.address}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Scheme</p>
              <p className="font-medium" style={{ color: "var(--foreground)" }}>{wallet.scheme}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Required Signatures</p>
              <p className="font-bold text-lg" style={{ color: "#3b82f6" }}>
                {wallet.threshold} of {wallet.owners.length}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>Your Identity</p>
              <p className="font-mono text-xs truncate" style={{ color: "var(--foreground)" }}>
                {currentOwner}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: "var(--muted)" }}>
              <Users className="w-3.5 h-3.5" /> Owners
            </p>
            <div className="flex flex-wrap gap-1.5">
              {wallet.owners.map((owner) => (
                <span
                  key={owner}
                  className="text-xs font-mono px-2 py-1 rounded-md"
                  style={{
                    background: owner === currentOwner ? "rgba(59, 130, 246, 0.12)" : "var(--card)",
                    border: "1px solid var(--border)",
                    color: owner === currentOwner ? "#3b82f6" : "var(--muted)",
                  }}
                >
                  {owner}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Propose transaction */}
      <form onSubmit={handleProposeSubmit(onPropose)} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Propose Transaction
        </p>
        <input
          {...registerPropose("target", { required: "Target address is required" })}
          placeholder="Target address (0x…)"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
        {proposeErrors.target && (
          <p className="text-xs text-red-500">{proposeErrors.target.message}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            {...registerPropose("value")}
            placeholder="Value (wei)"
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          <input
            {...registerPropose("data")}
            placeholder="Calldata (0x…)"
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <button
          type="submit"
          disabled={proposeMutation.isPending}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {proposeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PenLine className="w-4 h-4" />
          )}
          Propose Transaction
        </button>
      </form>

      {/* Active transaction & signature progress */}
      {activeTxId && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Signature Progress
            </p>
            {txStatus && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: `${STATUS_COLORS[txStatus.status]}20`,
                  color: STATUS_COLORS[txStatus.status],
                }}
              >
                {txStatus.status}
              </span>
            )}
          </div>

          <p className="font-mono text-xs truncate" style={{ color: "var(--muted)" }}>
            TX: {activeTxId}
          </p>

          {txLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--muted)" }} />
          ) : txStatus && wallet ? (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--muted)" }}>
                  <span>{txStatus.signatures.length} / {wallet.threshold} signatures</span>
                  <span>{Math.round(signatureProgress)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#3b82f6" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${signatureProgress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              {/* Collected signatures */}
              <div className="space-y-1.5">
                {wallet.owners.map((owner) => {
                  const signed = txStatus.signatures.find((s) => s.owner === owner);
                  return (
                    <div
                      key={owner}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg"
                      style={{ background: "var(--card)" }}
                    >
                      <span className="font-mono truncate" style={{ color: "var(--foreground)" }}>
                        {owner}
                      </span>
                      {signed ? (
                        <span className="flex items-center gap-1 text-green-500 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Signed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sign form */}
              {txStatus.status !== "Executed" && !hasSigned && (
                <form onSubmit={handleSignSubmit(onSign)} className="space-y-2">
                  <input
                    {...registerSign("signature", { required: "Signature is required" })}
                    placeholder="Enter signature (0x…)"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  {signErrors.signature && (
                    <p className="text-xs text-red-500">{signErrors.signature.message}</p>
                  )}
                  <button
                    type="submit"
                    disabled={signMutation.isPending}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {signMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PenLine className="w-4 h-4" />
                    )}
                    Submit Signature
                  </button>
                </form>
              )}

              {hasSigned && txStatus.status !== "Executed" && (
                <div className="flex items-center gap-2 text-xs text-green-600 p-2 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.08)" }}>
                  <CheckCircle2 className="w-4 h-4" />
                  You have signed this transaction
                </div>
              )}

              {/* Execute button */}
              {txStatus.status === "Ready" && (
                <button
                  type="button"
                  onClick={() => executeMutation.mutate(activeTxId)}
                  disabled={executeMutation.isPending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {executeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Execute Transaction
                </button>
              )}

              {txStatus.status === "Executed" && txStatus.txHash && (
                <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.08)", color: "#22c55e" }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="font-mono truncate">Executed: {txStatus.txHash}</span>
                </div>
              )}
            </>
          ) : null}
        </motion.div>
      )}

      {!activeTxId && (
        <div className="flex items-center gap-2 text-xs p-3 rounded-lg" style={{ background: "var(--background)", color: "var(--muted)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Propose a transaction above to begin collecting signatures
        </div>
      )}
    </div>
  );
}
