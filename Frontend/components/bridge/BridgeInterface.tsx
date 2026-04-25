"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { useToast } from "../../hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Chain {
  id: number;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  nativeCurrency: string;
  explorerUrl: string;
}

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
}

export interface BridgeRoute {
  id: string;
  provider: string;
  providerIcon: string;
  estimatedTime: string; // e.g. "~3 min"
  fee: string;           // e.g. "0.05 USDC"
  feeUsd: number;
  gasEstimate: string;   // e.g. "0.0012 ETH"
  gasUsd: number;
  outputAmount: string;
  recommended: boolean;
  steps: RouteStep[];
}

export interface RouteStep {
  type: "bridge" | "swap";
  fromChain: string;
  toChain: string;
  protocol: string;
  estimatedTime: string;
}

export type BridgeStatus =
  | "idle"
  | "approving"
  | "bridging"
  | "confirming"
  | "success"
  | "failed";

// ─── Static data ──────────────────────────────────────────────────────────────

const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 5000,
    name: "Mantle",
    shortName: "MNT",
    icon: "🔷",
    color: "#000000",
    nativeCurrency: "MNT",
    explorerUrl: "https://explorer.mantle.xyz",
  },
  {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    icon: "⟠",
    color: "#627EEA",
    nativeCurrency: "ETH",
    explorerUrl: "https://etherscan.io",
  },
  {
    id: 137,
    name: "Polygon",
    shortName: "MATIC",
    icon: "🟣",
    color: "#8247E5",
    nativeCurrency: "MATIC",
    explorerUrl: "https://polygonscan.com",
  },
  {
    id: 42161,
    name: "Arbitrum",
    shortName: "ARB",
    icon: "🔵",
    color: "#28A0F0",
    nativeCurrency: "ETH",
    explorerUrl: "https://arbiscan.io",
  },
  {
    id: 10,
    name: "Optimism",
    shortName: "OP",
    icon: "🔴",
    color: "#FF0420",
    nativeCurrency: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    id: 8453,
    name: "Base",
    shortName: "BASE",
    icon: "🔷",
    color: "#0052FF",
    nativeCurrency: "ETH",
    explorerUrl: "https://basescan.org",
  },
];

const SUPPORTED_TOKENS: Token[] = [
  { symbol: "USDC", name: "USD Coin", decimals: 6, logoUrl: "" },
  { symbol: "USDT", name: "Tether USD", decimals: 6, logoUrl: "" },
  { symbol: "ETH", name: "Ethereum", decimals: 18, logoUrl: "" },
  { symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8, logoUrl: "" },
  { symbol: "DAI", name: "Dai Stablecoin", decimals: 18, logoUrl: "" },
];

// Simulated routes — in production these come from a bridge aggregator API
function getMockRoutes(
  amount: string,
  token: string,
  fromChain: Chain,
  toChain: Chain
): BridgeRoute[] {
  const amt = parseFloat(amount) || 0;
  if (amt <= 0 || fromChain.id === toChain.id) return [];

  return [
    {
      id: "route-1",
      provider: "Stargate",
      providerIcon: "⭐",
      estimatedTime: "~3 min",
      fee: `${(amt * 0.0006).toFixed(4)} ${token}`,
      feeUsd: amt * 0.0006,
      gasEstimate: "0.0012 ETH",
      gasUsd: 2.04,
      outputAmount: `${(amt * 0.9994 - 0.0012 * 1700).toFixed(4)} ${token}`,
      recommended: true,
      steps: [
        {
          type: "bridge",
          fromChain: fromChain.name,
          toChain: toChain.name,
          protocol: "Stargate",
          estimatedTime: "~3 min",
        },
      ],
    },
    {
      id: "route-2",
      provider: "Across",
      providerIcon: "🌉",
      estimatedTime: "~1 min",
      fee: `${(amt * 0.001).toFixed(4)} ${token}`,
      feeUsd: amt * 0.001,
      gasEstimate: "0.0008 ETH",
      gasUsd: 1.36,
      outputAmount: `${(amt * 0.999 - 0.0008 * 1700).toFixed(4)} ${token}`,
      recommended: false,
      steps: [
        {
          type: "bridge",
          fromChain: fromChain.name,
          toChain: toChain.name,
          protocol: "Across",
          estimatedTime: "~1 min",
        },
      ],
    },
    {
      id: "route-3",
      provider: "Hop Protocol",
      providerIcon: "🐇",
      estimatedTime: "~8 min",
      fee: `${(amt * 0.0004).toFixed(4)} ${token}`,
      feeUsd: amt * 0.0004,
      gasEstimate: "0.0015 ETH",
      gasUsd: 2.55,
      outputAmount: `${(amt * 0.9996 - 0.0015 * 1700).toFixed(4)} ${token}`,
      recommended: false,
      steps: [
        {
          type: "bridge",
          fromChain: fromChain.name,
          toChain: toChain.name,
          protocol: "Hop",
          estimatedTime: "~8 min",
        },
      ],
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChainSelector({
  label,
  selected,
  chains,
  onChange,
  disabledId,
}: {
  label: string;
  selected: Chain;
  chains: Chain[];
  onChange: (c: Chain) => void;
  disabledId?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <span className="text-base">{selected.icon}</span>
        <span className="flex-1 text-left">{selected.name}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--muted)" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={`Select ${label}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl shadow-xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {chains.map((chain) => {
              const isDisabled = chain.id === disabledId;
              const isSelected = chain.id === selected.id;
              return (
                <li key={chain.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={isDisabled}
                    onClick={() => {
                      onChange(chain);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: isSelected ? "var(--border)" : "transparent",
                      color: "var(--foreground)",
                    }}
                  >
                    <span className="text-base">{chain.icon}</span>
                    <span className="flex-1 text-left font-medium">{chain.name}</span>
                    {isSelected && (
                      <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function RouteCard({
  route,
  selected,
  onSelect,
}: {
  route: BridgeRoute;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative w-full rounded-xl p-4 text-left transition-all"
      style={{
        background: selected ? "var(--background)" : "transparent",
        border: `1.5px solid ${selected ? "#3b82f6" : "var(--border)"}`,
        color: "var(--foreground)",
      }}
    >
      {route.recommended && (
        <span
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: "#3b82f6" }}
        >
          Best
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{route.providerIcon}</span>
        <span className="font-semibold text-sm">{route.provider}</span>
        <span className="ml-auto text-xs font-medium" style={{ color: "var(--muted)" }}>
          {route.estimatedTime}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p style={{ color: "var(--muted)" }}>You receive</p>
          <p className="mt-0.5 font-semibold text-sm">{route.outputAmount}</p>
        </div>
        <div>
          <p style={{ color: "var(--muted)" }}>Bridge fee</p>
          <p className="mt-0.5 font-medium">{route.fee}</p>
          <p style={{ color: "var(--muted)" }}>≈ ${route.feeUsd.toFixed(2)}</p>
        </div>
        <div>
          <p style={{ color: "var(--muted)" }}>Gas</p>
          <p className="mt-0.5 font-medium">{route.gasEstimate}</p>
          <p style={{ color: "var(--muted)" }}>≈ ${route.gasUsd.toFixed(2)}</p>
        </div>
      </div>

      {route.steps.length > 1 && (
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          {route.steps.map((step, i) => (
            <span key={i} className="flex items-center gap-1">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "var(--border)", color: "var(--muted)" }}
              >
                {step.protocol}
              </span>
              {i < route.steps.length - 1 && (
                <svg className="h-3 w-3" style={{ color: "var(--muted)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function StatusStep({
  label,
  status,
  txHash,
  explorerUrl,
}: {
  label: string;
  status: "pending" | "active" | "done" | "failed";
  txHash?: string;
  explorerUrl?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        {status === "done" && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {status === "active" && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
        {status === "pending" && (
          <div className="h-6 w-6 rounded-full" style={{ border: "2px solid var(--border)" }} />
        )}
        {status === "failed" && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{
            color:
              status === "active"
                ? "#3b82f6"
                : status === "done"
                ? "#22c55e"
                : status === "failed"
                ? "#ef4444"
                : "var(--muted)",
          }}
        >
          {label}
        </p>
        {txHash && explorerUrl && (
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-xs text-blue-500 hover:underline"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BridgeInterface() {
  const { address, isConnected } = useAccount();
  const { success, error: toastError, info } = useToast();

  // Form state
  const [fromChain, setFromChain] = useState<Chain>(SUPPORTED_CHAINS[0]); // Mantle
  const [toChain, setToChain] = useState<Chain>(SUPPORTED_CHAINS[1]);     // Ethereum
  const [selectedToken, setSelectedToken] = useState<Token>(SUPPORTED_TOKENS[0]); // USDC
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);

  // Route state
  const [routes, setRoutes] = useState<BridgeRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Transaction state
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Wagmi balance hook (reads native balance on connected chain)
  const { data: balanceData } = useBalance({
    address: address as `0x${string}` | undefined,
  });

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  // Swap chains
  const handleSwapChains = useCallback(() => {
    setFromChain(toChain);
    setToChain(fromChain);
    setRoutes([]);
    setSelectedRouteId(null);
  }, [fromChain, toChain]);

  // Fetch routes whenever inputs change
  const handleFetchRoutes = useCallback(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || fromChain.id === toChain.id) {
      setRoutes([]);
      setSelectedRouteId(null);
      return;
    }
    setLoadingRoutes(true);
    setRoutes([]);
    setSelectedRouteId(null);
    // Simulate async API call
    setTimeout(() => {
      const r = getMockRoutes(amount, selectedToken.symbol, fromChain, toChain);
      setRoutes(r);
      setSelectedRouteId(r[0]?.id ?? null);
      setLoadingRoutes(false);
    }, 900);
  }, [amount, selectedToken, fromChain, toChain]);

  // Simulate bridge transaction
  const handleBridge = useCallback(async () => {
    if (!selectedRoute || !isConnected) return;
    setShowConfirmModal(false);
    setBridgeStatus("approving");

    try {
      // Step 1: Token approval
      await new Promise((res) => setTimeout(res, 1500));
      info("Approval submitted", "Waiting for confirmation…");

      // Step 2: Bridge transaction
      setBridgeStatus("bridging");
      await new Promise((res) => setTimeout(res, 2000));
      const mockSourceHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      setSourceTxHash(mockSourceHash);
      info("Bridge transaction sent", "Waiting for destination confirmation…");

      // Step 3: Destination confirmation
      setBridgeStatus("confirming");
      await new Promise((res) => setTimeout(res, 3000));
      const mockDestHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      setDestTxHash(mockDestHash);

      setBridgeStatus("success");
      success(
        "Bridge complete!",
        `${amount} ${selectedToken.symbol} arrived on ${toChain.name}.`
      );
    } catch {
      setBridgeStatus("failed");
      toastError("Bridge failed", "Transaction was rejected or timed out.");
    }
  }, [selectedRoute, isConnected, amount, selectedToken, toChain, info, success, toastError]);

  const handleReset = () => {
    setBridgeStatus("idle");
    setSourceTxHash(null);
    setDestTxHash(null);
    setAmount("");
    setRoutes([]);
    setSelectedRouteId(null);
  };

  const isProcessing =
    bridgeStatus === "approving" ||
    bridgeStatus === "bridging" ||
    bridgeStatus === "confirming";

  // ── Render: status view ────────────────────────────────────────────────────
  if (bridgeStatus !== "idle") {
    const steps: Array<{ label: string; status: "pending" | "active" | "done" | "failed"; txHash?: string; explorerUrl?: string }> = [
      {
        label: "Approve token spending",
        status:
          bridgeStatus === "approving"
            ? "active"
            : bridgeStatus === "failed" && !sourceTxHash
            ? "failed"
            : "done",
      },
      {
        label: `Send on ${fromChain.name}`,
        status:
          bridgeStatus === "bridging"
            ? "active"
            : bridgeStatus === "failed" && sourceTxHash && !destTxHash
            ? "failed"
            : sourceTxHash
            ? "done"
            : "pending",
        txHash: sourceTxHash ?? undefined,
        explorerUrl: fromChain.explorerUrl,
      },
      {
        label: `Confirm on ${toChain.name}`,
        status:
          bridgeStatus === "confirming"
            ? "active"
            : bridgeStatus === "success"
            ? "done"
            : bridgeStatus === "failed" && destTxHash
            ? "failed"
            : "pending",
        txHash: destTxHash ?? undefined,
        explorerUrl: toChain.explorerUrl,
      },
    ];

    return (
      <div
        className="mx-auto w-full max-w-lg rounded-3xl p-6 shadow-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold tracking-widest" style={{ color: "#3b82f6" }}>
              Bridge status
            </p>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              {bridgeStatus === "success"
                ? "Transfer complete"
                : bridgeStatus === "failed"
                ? "Transfer failed"
                : "Transfer in progress"}
            </h2>
          </div>
          {(bridgeStatus === "success" || bridgeStatus === "failed") && (
            <button
              onClick={handleReset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: bridgeStatus === "success" ? "#22c55e" : "#3b82f6" }}
            >
              {bridgeStatus === "success" ? "New transfer" : "Try again"}
            </button>
          )}
        </div>

        {/* Summary */}
        <div
          className="mb-6 rounded-2xl p-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">{fromChain.icon}</span>
              <span className="font-medium">{fromChain.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--muted)" }}>
              <span>{amount} {selectedToken.symbol}</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">{toChain.icon}</span>
              <span className="font-medium">{toChain.name}</span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, i) => (
            <StatusStep key={i} {...step} />
          ))}
        </div>

        {bridgeStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-green-300/50 bg-green-50 p-4 text-sm dark:bg-green-950/30"
          >
            <p className="font-semibold text-green-800 dark:text-green-300">Transfer complete 🎉</p>
            <p className="mt-1 text-green-700 dark:text-green-400">
              {amount} {selectedToken.symbol} has arrived on {toChain.name}. Funds are ready to use.
            </p>
          </motion.div>
        )}

        {bridgeStatus === "failed" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-red-300/50 bg-red-50 p-4 text-sm dark:bg-red-950/30"
          >
            <p className="font-semibold text-red-800 dark:text-red-300">Transfer failed</p>
            <p className="mt-1 text-red-700 dark:text-red-400">
              The transaction was rejected or timed out. No funds were lost. Please try again.
            </p>
          </motion.div>
        )}

        {isProcessing && (
          <p className="mt-6 text-center text-xs" style={{ color: "var(--muted)" }}>
            Do not close this window while the transfer is in progress.
          </p>
        )}
      </div>
    );
  }

  // ── Render: main form ──────────────────────────────────────────────────────
  return (
    <>
      <div
        className="mx-auto w-full max-w-lg rounded-3xl p-6 shadow-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase font-semibold tracking-widest" style={{ color: "#3b82f6" }}>
            Cross-chain bridge
          </p>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Move assets between networks
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Bridge tokens across chains using the best available route.
          </p>
        </div>

        {/* Chain selectors */}
        <div className="relative mb-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <ChainSelector
            label="From"
            selected={fromChain}
            chains={SUPPORTED_CHAINS}
            onChange={(c) => { setFromChain(c); setRoutes([]); setSelectedRouteId(null); }}
            disabledId={toChain.id}
          />

          <button
            type="button"
            onClick={handleSwapChains}
            aria-label="Swap source and destination chains"
            className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110 hover:opacity-80"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>

          <ChainSelector
            label="To"
            selected={toChain}
            chains={SUPPORTED_CHAINS}
            onChange={(c) => { setToChain(c); setRoutes([]); setSelectedRouteId(null); }}
            disabledId={fromChain.id}
          />
        </div>

        {/* Token + Amount */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--muted)" }}>
            Token &amp; amount
          </p>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            {/* Token picker */}
            <select
              value={selectedToken.symbol}
              onChange={(e) => {
                const t = SUPPORTED_TOKENS.find((tk) => tk.symbol === e.target.value)!;
                setSelectedToken(t);
                setRoutes([]);
                setSelectedRouteId(null);
              }}
              className="rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="Select token"
            >
              {SUPPORTED_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setRoutes([]);
                setSelectedRouteId(null);
              }}
              className="flex-1 bg-transparent text-right text-lg font-semibold focus:outline-none"
              style={{ color: "var(--foreground)" }}
              aria-label="Amount to bridge"
            />
          </div>

          {/* Balance hint */}
          {isConnected && balanceData && (
            <p className="mt-1 text-right text-xs" style={{ color: "var(--muted)" }}>
              Balance: {parseFloat(balanceData.formatted).toFixed(4)} {balanceData.symbol}
            </p>
          )}
        </div>

        {/* Custom recipient toggle */}
        <div className="mb-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={useCustomRecipient}
              onChange={(e) => setUseCustomRecipient(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Send to a different address
          </label>
          <AnimatePresence>
            {useCustomRecipient && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  placeholder="0x… recipient address"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  aria-label="Recipient address"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Get routes button */}
        <button
          type="button"
          onClick={handleFetchRoutes}
          disabled={!amount || parseFloat(amount) <= 0 || fromChain.id === toChain.id || loadingRoutes}
          className="mb-4 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#3b82f6" }}
        >
          {loadingRoutes ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Finding best routes…
            </span>
          ) : (
            "Find routes"
          )}
        </button>

        {/* Routes */}
        <AnimatePresence>
          {routes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-4 space-y-2"
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Available routes
              </p>
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  selected={selectedRouteId === route.id}
                  onSelect={() => setSelectedRouteId(route.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bridge button */}
        {!isConnected ? (
          <p
            className="rounded-xl py-3 text-center text-sm font-medium"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            Connect your wallet to bridge
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={!selectedRoute || !amount || parseFloat(amount) <= 0}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#3b82f6" }}
          >
            Bridge {amount ? `${amount} ${selectedToken.symbol}` : "tokens"}
          </button>
        )}

        {/* Disclaimer */}
        <p className="mt-4 text-center text-xs" style={{ color: "var(--muted)" }}>
          Bridge routes are provided by third-party protocols. Always verify amounts before confirming.
        </p>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirmModal && selectedRoute && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
              aria-hidden="true"
            />
            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bridge-confirm-title"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase font-semibold tracking-widest" style={{ color: "#3b82f6" }}>
                    Confirm bridge
                  </p>
                  <h2 id="bridge-confirm-title" className="mt-1 text-xl font-semibold">
                    Review transfer
                  </h2>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  aria-label="Close confirmation"
                  className="rounded-full p-2 transition-opacity hover:opacity-80"
                  style={{ color: "var(--muted)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div
                className="mb-4 rounded-2xl p-4 space-y-3 text-sm"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
              >
                {[
                  ["From", `${fromChain.icon} ${fromChain.name}`],
                  ["To", `${toChain.icon} ${toChain.name}`],
                  ["You send", `${amount} ${selectedToken.symbol}`],
                  ["You receive", selectedRoute.outputAmount],
                  ["Via", `${selectedRoute.providerIcon} ${selectedRoute.provider}`],
                  ["Bridge fee", `${selectedRoute.fee} (≈ $${selectedRoute.feeUsd.toFixed(2)})`],
                  ["Gas estimate", `${selectedRoute.gasEstimate} (≈ $${selectedRoute.gasUsd.toFixed(2)})`],
                  ["Est. time", selectedRoute.estimatedTime],
                  ...(useCustomRecipient && recipient ? [["Recipient", `${recipient.slice(0, 8)}…${recipient.slice(-6)}`]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span style={{ color: "var(--muted)" }}>{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mb-5 rounded-2xl border border-amber-300/50 bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
                <p className="font-semibold text-amber-800 dark:text-amber-300">Before you confirm</p>
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  Cross-chain transfers are irreversible. Verify the destination chain and recipient address carefully.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBridge}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#3b82f6" }}
                >
                  Confirm bridge
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
