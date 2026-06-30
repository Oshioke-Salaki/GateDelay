"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useToast } from "../../hooks/useToast";
import { useSettings } from "../../hooks/useSettings";
import { ErrorBoundary } from "../../app/components/ui/ErrorBoundary";
import { 
  Zap, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ChevronDown, 
  Search, 
  Wallet,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Contract Configuration ──────────────────────────────────────────────────

const MARKET_MAKER_ABI = [
  {
    name: "buy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcome", type: "uint256" },
      { name: "shares", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const MARKET_MAKER_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKET_MAKER_ADDRESS as `0x${string}`) ?? "0x0000000000000000000000000000000000000000";

// ─── Market Definitions & Cache ──────────────────────────────────────────────

export interface QuickTradeMarket {
  id: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  status: "open" | "closed" | "resolved";
}

const DEFAULT_MARKETS: QuickTradeMarket[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 14820,
    status: "open",
  },
  {
    id: "2",
    title: "Will UA456 be delayed > 30 min?",
    yesPrice: 0.41,
    noPrice: 0.59,
    volume: 8300,
    status: "open",
  },
  {
    id: "3",
    title: "Will DL789 be cancelled?",
    yesPrice: 0.08,
    noPrice: 0.92,
    volume: 3200,
    status: "open",
  },
  {
    id: "4",
    title: "Will Bitcoin exceed $100k by EOY?",
    yesPrice: 0.72,
    noPrice: 0.28,
    volume: 125000,
    status: "open",
  },
  {
    id: "5",
    title: "Will Ethereum outperform Bitcoin?",
    yesPrice: 0.35,
    noPrice: 0.65,
    volume: 89000,
    status: "open",
  },
];

const LOCAL_STORAGE_KEY = "gate_delay_quick_trade_recent_markets";

const getRecentMarkets = (): QuickTradeMarket[] => {
  if (typeof window === "undefined") return DEFAULT_MARKETS;
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as QuickTradeMarket[];
      if (parsed && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load cached markets", e);
  }
  return DEFAULT_MARKETS;
};

const saveRecentMarket = (market: QuickTradeMarket) => {
  try {
    const current = getRecentMarkets();
    const filtered = current.filter((m) => m.id !== market.id);
    const updated = [market, ...filtered].slice(0, 5);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to cache market", e);
  }
};

// ─── Coordinated Store (State Synchronization) ───────────────────────────────

export type TradeExecutionState = {
  status: "idle" | "submitting" | "confirming" | "success" | "error";
  activeMarketId?: string;
  activeSide?: "YES" | "NO";
  activeAmount?: number;
  txHash?: `0x${string}`;
  error?: Error | null;
  errorMessage?: string;
};

type Listener = (state: TradeExecutionState) => void;

class QuickTradeStore {
  private state: TradeExecutionState = { status: "idle" };
  private listeners = new Set<Listener>();

  getState() {
    return this.state;
  }

  setState(newState: Partial<TradeExecutionState>) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const quickTradeStore = new QuickTradeStore();

function useQuickTradeState() {
  const [state, setState] = useState<TradeExecutionState>(quickTradeStore.getState());

  useEffect(() => {
    return quickTradeStore.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}

// ─── Main Component ──────────────────────────────────────────────────────────

function QuickTradeWidgetInner() {
  const { isConnected } = useAccount();
  const toast = useToast();
  const { settings } = useSettings();
  const globalState = useQuickTradeState();

  // Local state
  const [recentMarkets, setRecentMarkets] = useState<QuickTradeMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<QuickTradeMarket>(DEFAULT_MARKETS[0]);
  const [amount, setAmount] = useState<string>("50");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [oneClickMode, setOneClickMode] = useState(true);
  const [customSide, setCustomSide] = useState<"YES" | "NO">("YES");

  const isExecutingHere = useRef(false);

  // Wagmi hooks
  const { writeContract, data: txHash, isPending: isSigning, error: signError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash: txHash });

  // Initialize cached recent assets
  useEffect(() => {
    const loaded = getRecentMarkets();
    setRecentMarkets(loaded);
    if (loaded.length > 0) {
      setSelectedMarket(loaded[0]);
    }
  }, []);

  // Synchronize local hook events to the global store
  useEffect(() => {
    if (!isExecutingHere.current) return;

    if (isSigning) {
      quickTradeStore.setState({ status: "submitting" });
    } else if (txHash && globalState.status === "submitting") {
      quickTradeStore.setState({ status: "confirming", txHash });
    } else if (isSuccess) {
      quickTradeStore.setState({ status: "success" });
      toast.success("Quick Trade Executed", `Successfully bought $${globalState.activeAmount} of ${globalState.activeSide} shares!`);
      isExecutingHere.current = false;
      // Refresh balance or update store state
    } else if (signError || confirmError) {
      const err = signError || confirmError;
      let errorMsg = "Transaction failed.";
      const rawMsg = err?.message || "";

      if (rawMsg.includes("User rejected") || rawMsg.includes("UserRejectedRequestError") || rawMsg.includes("rejected the request")) {
        errorMsg = "Transaction was cancelled in wallet.";
      } else if (rawMsg.includes("insufficient funds")) {
        errorMsg = "Insufficient balance for transaction & gas.";
      } else if (rawMsg.includes("reverted") || rawMsg.includes("execution reverted")) {
        errorMsg = "Slippage tolerance exceeded or market contract reverted.";
      } else if (err) {
        errorMsg = err.message;
      }

      quickTradeStore.setState({
        status: "error",
        error: err,
        errorMessage: errorMsg,
      });
      toast.error("Quick Trade Failed", errorMsg);
      isExecutingHere.current = false;
    }
  }, [isSigning, txHash, isSuccess, signError, confirmError, globalState.status, globalState.activeAmount, globalState.activeSide, toast]);

  // Execute Order handler
  const handleExecuteTrade = useCallback((side: "YES" | "NO", tradeAmount: number) => {
    if (!isConnected) {
      toast.error("Wallet Not Connected", "Please connect your wallet first.");
      return;
    }

    if (tradeAmount <= 0) {
      toast.error("Invalid Amount", "Please input an amount greater than 0.");
      return;
    }

    const mockBalance = 1000; // Mock balance matching project standard
    if (tradeAmount > mockBalance) {
      toast.error("Insufficient Balance", "Your order size exceeds your available balance (1000 USDC).");
      return;
    }

    // Save selected market to recent list
    saveRecentMarket(selectedMarket);
    setRecentMarkets(getRecentMarkets());

    // Flag this instance as the execution manager
    isExecutingHere.current = true;
    resetWrite();

    // Calculate shares: (amount / price)
    const price = side === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice;
    const calculatedShares = tradeAmount / price;
    const sharesBigInt = BigInt(Math.floor(calculatedShares * 1e18));

    // Update global store
    quickTradeStore.setState({
      status: "submitting",
      activeMarketId: selectedMarket.id,
      activeSide: side,
      activeAmount: tradeAmount,
      error: null,
      errorMessage: "",
      txHash: undefined,
    });

    try {
      writeContract({
        address: MARKET_MAKER_ADDRESS,
        abi: MARKET_MAKER_ABI,
        functionName: "buy",
        args: [BigInt(selectedMarket.id), BigInt(side === "YES" ? 0 : 1), sharesBigInt],
      });
    } catch (err: any) {
      quickTradeStore.setState({
        status: "error",
        error: err,
        errorMessage: err.message || "Failed to trigger wallet.",
      });
      toast.error("Wallet Trigger Failed", err.message || "Could not write to contract.");
      isExecutingHere.current = false;
    }
  }, [isConnected, selectedMarket, writeContract, resetWrite, toast]);

  const handlePresetClick = (side: "YES" | "NO", presetAmount: number) => {
    if (oneClickMode) {
      handleExecuteTrade(side, presetAmount);
    } else {
      setAmount(presetAmount.toString());
      setCustomSide(side);
    }
  };

  const handleDismiss = () => {
    quickTradeStore.setState({ status: "idle" });
    resetWrite();
    isExecutingHere.current = false;
  };

  const parsedAmount = parseFloat(amount) || 0;
  const price = customSide === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice;
  const estShares = parsedAmount > 0 ? (parsedAmount / price).toFixed(2) : "0.00";

  // Filter dropdown markets
  const allAvailableMarkets = DEFAULT_MARKETS;
  const filteredMarkets = allAvailableMarkets.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isActiveExecution = globalState.status !== "idle";
  const isBusy = globalState.status === "submitting" || globalState.status === "confirming";

  return (
    <div 
      className="rounded-3xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)"
      }}
    >
      {/* Background radial highlight */}
      <div className="absolute -right-20 -top-20 -z-10 w-44 h-44 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 -z-10 w-44 h-44 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-1.5 bg-blue-500/10 text-blue-500">
            <Zap size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">Quick Trade</h3>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>Pre-configured parameters</p>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium hidden sm:inline" style={{ color: "var(--muted)" }}>One-Click</span>
          <button 
            onClick={() => setOneClickMode(!oneClickMode)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${oneClickMode ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-800"}`}
            aria-label="Toggle One-Click Mode"
          >
            <motion.div 
              layout 
              className="w-4 h-4 rounded-full bg-white shadow-md"
              animate={{ x: oneClickMode ? 16 : 0 }}
            />
          </button>
        </div>
      </div>

      {/* Dropdown for Selection */}
      <div className="relative mb-4">
        <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1.5" style={{ color: "var(--muted)" }}>
          Select Asset / Market
        </label>
        <button
          onClick={() => !isBusy && setIsDropdownOpen(!isDropdownOpen)}
          disabled={isBusy}
          className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all border outline-none hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            color: "var(--foreground)"
          }}
        >
          <span className="truncate max-w-[85%]">{selectedMarket.title}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <>
            {/* Backdrop click dismisser */}
            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
            
            <div 
              className="absolute z-20 top-full left-0 w-full mt-1.5 rounded-xl shadow-2xl overflow-hidden border max-h-60 overflow-y-auto"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)"
              }}
            >
              {/* Search input inside dropdown */}
              <div className="p-2 border-b flex items-center gap-1.5 bg-black/5 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
                <Search size={12} className="text-zinc-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter assets..."
                  className="w-full text-xs outline-none bg-transparent"
                />
              </div>

              {/* Cached Recent Section */}
              {recentMarkets.length > 0 && searchQuery === "" && (
                <div className="py-1">
                  <div className="px-3 py-0.5 text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                    <Clock size={10} /> RECENTLY SELECTED
                  </div>
                  {recentMarkets.map((m) => (
                    <button
                      key={`recent-${m.id}`}
                      onClick={() => {
                        setSelectedMarket(m);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-1.5 text-xs hover:bg-blue-600/10 transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">{m.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400">#{m.id}</span>
                    </button>
                  ))}
                  <div className="border-b my-1" style={{ borderColor: "var(--border)" }} />
                </div>
              )}

              {/* Markets List */}
              <div className="py-1">
                {filteredMarkets.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-zinc-500">No assets found</p>
                ) : (
                  filteredMarkets.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMarket(m);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-1.5 text-xs hover:bg-blue-600/10 transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">{m.title}</span>
                      <span className="font-semibold text-[10px] text-zinc-400">{`${(m.yesPrice * 100).toFixed(0)}¢ YES`}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Market Mini Pricing Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4 p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-zinc-100 dark:border-zinc-800 text-xs">
        <div>
          <div className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
            <TrendingUp size={10} className="text-green-500" /> YES Share Price
          </div>
          <span className="font-bold text-sm text-green-500">{(selectedMarket.yesPrice * 100).toFixed(0)}¢</span>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
            <TrendingDown size={10} className="text-red-500" /> NO Share Price
          </div>
          <span className="font-bold text-sm text-red-500">{(selectedMarket.noPrice * 100).toFixed(0)}¢</span>
        </div>
      </div>

      {/* Coordinated Transaction Overlay / Status Display */}
      <AnimatePresence mode="wait">
        {isActiveExecution ? (
          <motion.div
            key="execution-feedback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border p-4 mb-4 text-xs space-y-3"
            style={{
              background: "var(--background)",
              borderColor: 
                globalState.status === "success" 
                  ? "rgba(34,197,94,0.3)" 
                  : globalState.status === "error" 
                    ? "rgba(239,68,68,0.3)" 
                    : "rgba(124,58,237,0.3)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {isBusy && <Loader2 size={14} className="animate-spin text-purple-600" />}
                {globalState.status === "success" && <CheckCircle2 size={14} className="text-emerald-500" />}
                {globalState.status === "error" && <XCircle size={14} className="text-rose-500" />}
                <span>
                  {globalState.status === "submitting" && "Submitting..."}
                  {globalState.status === "confirming" && "Confirming..."}
                  {globalState.status === "success" && "Success"}
                  {globalState.status === "error" && "Execution Failed"}
                </span>
              </div>

              {!isBusy && (
                <button 
                  onClick={handleDismiss}
                  className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-semibold text-[10px]"
                >
                  Dismiss
                </button>
              )}
            </div>

            <p style={{ color: "var(--muted)" }}>
              {isBusy && `Buying $${globalState.activeAmount} of ${globalState.activeSide} shares. Confirm wallet...`}
              {globalState.status === "success" && `Completed buying $${globalState.activeAmount} of ${globalState.activeSide} shares.`}
              {globalState.status === "error" && globalState.errorMessage}
            </p>

            {globalState.txHash && (
              <div className="pt-2 border-t flex justify-between items-center text-[10px]" style={{ borderColor: "var(--border)" }}>
                <span className="font-mono text-zinc-400 truncate max-w-[60%]">{globalState.txHash}</span>
                <a
                  href={`https://etherscan.io/tx/${globalState.txHash}`} // Replace with Mantle explorer if config supports it
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-blue-500 hover:underline"
                >
                  Explorer <ArrowUpRight size={10} />
                </a>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Preset Action Buttons (One-Click Orders) */}
      <div className="mb-4">
        <label className="text-[10px] uppercase tracking-wider font-semibold block mb-2" style={{ color: "var(--muted)" }}>
          {oneClickMode ? "One-Click Execution" : "Select Preset Details"}
        </label>
        
        <div className="grid grid-cols-2 gap-3">
          {/* YES presets */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-green-500 uppercase block tracking-wider">Buy YES</span>
            {[10, 50, 100].map((amt) => (
              <button
                key={`yes-${amt}`}
                disabled={isBusy}
                onClick={() => handlePresetClick("YES", amt)}
                className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-green-600 dark:text-green-400 border border-green-500/20 bg-green-500/5 hover:bg-green-500/15 transition-all disabled:opacity-50 flex items-center justify-between"
              >
                <span>${amt}</span>
                <span className="text-[9px] opacity-75 font-normal">{(amt / selectedMarket.yesPrice).toFixed(0)} sh</span>
              </button>
            ))}
          </div>

          {/* NO presets */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-red-500 uppercase block tracking-wider">Buy NO</span>
            {[10, 50, 100].map((amt) => (
              <button
                key={`no-${amt}`}
                disabled={isBusy}
                onClick={() => handlePresetClick("NO", amt)}
                className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 transition-all disabled:opacity-50 flex items-center justify-between"
              >
                <span>${amt}</span>
                <span className="text-[9px] opacity-75 font-normal">{(amt / selectedMarket.noPrice).toFixed(0)} sh</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Amount / Execute section */}
      <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase font-semibold block mb-1" style={{ color: "var(--muted)" }}>
              Custom Amount (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                disabled={isBusy}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl px-3 py-2 text-xs outline-none border transition-colors disabled:opacity-50"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)"
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">USDC</span>
            </div>
          </div>

          <div className="w-1/3">
            <label className="text-[10px] uppercase font-semibold block mb-1" style={{ color: "var(--muted)" }}>
              Side
            </label>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setCustomSide(s)}
                  className="flex-1 py-2 text-xs font-bold transition-all disabled:opacity-50"
                  style={{
                    background: customSide === s ? (s === "YES" ? "#22c55e" : "#ef4444") : "transparent",
                    color: customSide === s ? "#fff" : "var(--muted)"
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculations */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-zinc-100 dark:border-zinc-800 text-[10px]">
          <div className="flex justify-between items-center text-zinc-400">
            <span>Price Per Share</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{price.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Estimated Shares</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{estShares}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Slippage Tolerance</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{settings?.trading?.defaultSlippage ?? 0.5}%</span>
          </div>
        </div>

        {/* Account balance context */}
        <div className="flex justify-between items-center text-[10px] px-1" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1"><Wallet size={10} /> Available Balance:</span>
          <span className="font-bold">1,000.00 USDC</span>
        </div>

        {/* Submit manual trade */}
        <button
          disabled={isBusy || parsedAmount <= 0}
          onClick={() => handleExecuteTrade(customSide, parsedAmount)}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
          style={{ background: customSide === "YES" ? "#22c55e" : "#ef4444" }}
        >
          {isBusy ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Processing...
            </>
          ) : (
            `Execute ${customSide} Trade`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Export wrapped with ErrorBoundary ───────────────────────────────────────

export default function QuickTradeWidget() {
  return (
    <ErrorBoundary level="component">
      <QuickTradeWidgetInner />
    </ErrorBoundary>
  );
}
