"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useToast } from "../../hooks/useToast";
import { ErrorBoundary } from "../../app/components/ui/ErrorBoundary";
import { CheckSquare, Square, Loader2, CheckCircle2, XCircle, AlertCircle, RotateCcw, Play } from "lucide-react";
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

// ─── Mock Data ───────────────────────────────────────────────────────────────

export interface QuickTradeMarket {
  id: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  status: "open" | "closed" | "resolved";
}

const DEFAULT_MARKETS: QuickTradeMarket[] = [
  { id: "1", title: "Will AA123 arrive on time?", yesPrice: 0.62, noPrice: 0.38, volume: 14820, status: "open" },
  { id: "2", title: "Will UA456 be delayed > 30 min?", yesPrice: 0.41, noPrice: 0.59, volume: 8300, status: "open" },
  { id: "3", title: "Will DL789 be cancelled?", yesPrice: 0.08, noPrice: 0.92, volume: 3200, status: "open" },
  { id: "4", title: "Will Bitcoin exceed $100k by EOY?", yesPrice: 0.72, noPrice: 0.28, volume: 125000, status: "open" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type BatchFormValues = {
  side: "YES" | "NO";
  amountPerMarket: number;
};

type TradeStatus = "pending" | "submitting" | "confirming" | "success" | "error";

interface TradeTask {
  id: string;
  market: QuickTradeMarket;
  side: "YES" | "NO";
  amount: number;
  status: TradeStatus;
  txHash?: `0x${string}`;
  error?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

function BatchTradingInner() {
  const { isConnected } = useAccount();
  const toast = useToast();
  
  // Market Selection
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set());
  
  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeQueue, setTradeQueue] = useState<TradeTask[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showSummary, setShowSummary] = useState(false);

  // Wagmi Hooks
  const { writeContract, data: txHash, isPending: isSigning, error: signError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash: txHash });

  const { control, handleSubmit, formState: { errors, isValid } } = useForm<BatchFormValues>({
    defaultValues: { side: "YES", amountPerMarket: 10 },
    mode: "onChange"
  });

  const toggleMarket = (id: string) => {
    const next = new Set(selectedMarketIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMarketIds(next);
  };

  const selectAll = () => setSelectedMarketIds(new Set(DEFAULT_MARKETS.map(m => m.id)));
  const deselectAll = () => setSelectedMarketIds(new Set());

  // ─── Queue Processing ────────────────────────────────────────────────────────

  const processNext = useCallback(() => {
    if (currentIndex >= tradeQueue.length) {
      setIsExecuting(false);
      setShowSummary(true);
      return;
    }

    const task = tradeQueue[currentIndex];
    if (task.status === "success") {
      // Skip already successful (e.g. during retry)
      setCurrentIndex(prev => prev + 1);
      return;
    }

    resetWrite();
    setTradeQueue(prev => prev.map((t, i) => i === currentIndex ? { ...t, status: "submitting", error: undefined } : t));

    const price = task.side === "YES" ? task.market.yesPrice : task.market.noPrice;
    const sharesBigInt = BigInt(Math.floor((task.amount / price) * 1e18));

    try {
      writeContract({
        address: MARKET_MAKER_ADDRESS,
        abi: MARKET_MAKER_ABI,
        functionName: "buy",
        args: [BigInt(task.market.id), BigInt(task.side === "YES" ? 0 : 1), sharesBigInt],
      });
    } catch (err: any) {
      setTradeQueue(prev => prev.map((t, i) => i === currentIndex ? { ...t, status: "error", error: err.message || "Failed to trigger wallet" } : t));
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, tradeQueue, writeContract, resetWrite]);

  useEffect(() => {
    if (isExecuting && tradeQueue.length > 0 && currentIndex < tradeQueue.length) {
      const currentTask = tradeQueue[currentIndex];
      if (currentTask.status === "pending" || currentTask.status === "error") {
         processNext();
      }
    }
  }, [isExecuting, currentIndex, tradeQueue, processNext]);

  // Synchronize Wagmi state to current task
  useEffect(() => {
    if (!isExecuting || currentIndex >= tradeQueue.length) return;

    if (txHash && tradeQueue[currentIndex].status === "submitting") {
      setTradeQueue(prev => prev.map((t, i) => i === currentIndex ? { ...t, status: "confirming", txHash } : t));
    } else if (isSuccess) {
      setTradeQueue(prev => prev.map((t, i) => i === currentIndex ? { ...t, status: "success" } : t));
      setCurrentIndex(prev => prev + 1);
    } else if (signError || confirmError) {
      const err = signError || confirmError;
      let errorMsg = "Transaction failed.";
      const rawMsg = err?.message || "";
      if (rawMsg.includes("User rejected") || rawMsg.includes("rejected the request")) errorMsg = "Cancelled in wallet.";
      else if (rawMsg.includes("insufficient funds")) errorMsg = "Insufficient balance.";
      
      setTradeQueue(prev => prev.map((t, i) => i === currentIndex ? { ...t, status: "error", error: errorMsg } : t));
      setCurrentIndex(prev => prev + 1); // Move to next even on error
    }
  }, [isSigning, txHash, isSuccess, signError, confirmError, isExecuting, currentIndex]);


  // ─── Handlers ────────────────────────────────────────────────────────────────

  const onSubmit = (data: BatchFormValues) => {
    if (!isConnected) {
      toast.error("Wallet Not Connected", "Please connect your wallet first.");
      return;
    }
    if (selectedMarketIds.size === 0) {
      toast.error("No Markets Selected", "Please select at least one market.");
      return;
    }

    const tasks: TradeTask[] = Array.from(selectedMarketIds).map(id => {
      const market = DEFAULT_MARKETS.find(m => m.id === id)!;
      return {
        id: `${id}-${Date.now()}`,
        market,
        side: data.side,
        amount: data.amountPerMarket,
        status: "pending"
      };
    });

    setTradeQueue(tasks);
    setCurrentIndex(0);
    setIsExecuting(true);
    setShowSummary(false);
  };

  const handleRetryFailed = () => {
    setTradeQueue(prev => prev.map(t => t.status === "error" ? { ...t, status: "pending", error: undefined } : t));
    setCurrentIndex(0);
    setIsExecuting(true);
    setShowSummary(false);
  };

  const handleReset = () => {
    setTradeQueue([]);
    setCurrentIndex(0);
    setIsExecuting(false);
    setShowSummary(false);
  };

  // ─── Render Helpers ──────────────────────────────────────────────────────────

  const successfulCount = tradeQueue.filter(t => t.status === "success").length;
  const failedCount = tradeQueue.filter(t => t.status === "error").length;
  const progressPercent = tradeQueue.length > 0 ? (currentIndex / tradeQueue.length) * 100 : 0;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Batch Trading</h2>
        <p className="text-sm text-zinc-500">Execute trades across multiple markets simultaneously.</p>
      </div>

      {tradeQueue.length > 0 ? (
        <div className="space-y-6">
          {/* Progress / Summary View */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm">
                {isExecuting ? "Executing Batch..." : "Batch Complete"}
              </span>
              <span className="text-xs font-mono">{currentIndex} / {tradeQueue.length}</span>
            </div>
            
            <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {showSummary && (
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> {successfulCount} Successful
                </div>
                {failedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <XCircle size={16} /> {failedCount} Failed
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {tradeQueue.map((task, i) => (
              <div 
                key={task.id} 
                className={`p-3 rounded-xl border flex items-center justify-between text-sm transition-colors ${
                  i === currentIndex && isExecuting 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <div>
                  <div className="font-semibold">{task.market.title}</div>
                  <div className="text-xs text-zinc-500">
                    Buy {task.side} for ${task.amount}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {task.status === "pending" && <span className="text-zinc-400">Waiting</span>}
                  {(task.status === "submitting" || task.status === "confirming") && (
                    <span className="flex items-center gap-1.5 text-blue-500">
                      <Loader2 size={14} className="animate-spin" />
                      {task.status === "submitting" ? "Signing" : "Confirming"}
                    </span>
                  )}
                  {task.status === "success" && (
                    <span className="flex items-center gap-1.5 text-emerald-500">
                      <CheckCircle2 size={14} /> Success
                    </span>
                  )}
                  {task.status === "error" && (
                    <span className="flex items-center gap-1.5 text-rose-500" title={task.error}>
                      <AlertCircle size={14} /> Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showSummary && (
            <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              {failedCount > 0 && (
                <button
                  onClick={handleRetryFailed}
                  className="flex-1 py-2.5 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/30 font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw size={16} /> Retry Failed
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 font-semibold transition-colors"
              >
                New Batch
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-sm font-semibold">Select Markets</label>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                <button type="button" onClick={deselectAll} className="text-blue-600 dark:text-blue-400 hover:underline">Deselect All</button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {DEFAULT_MARKETS.map(market => (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => toggleMarket(market.id)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                    selectedMarketIds.has(market.id) 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                  aria-pressed={selectedMarketIds.has(market.id)}
                >
                  {selectedMarketIds.has(market.id) ? (
                    <CheckSquare size={18} className="text-blue-500" />
                  ) : (
                    <Square size={18} className="text-zinc-400" />
                  )}
                  <div className="flex-1 truncate">
                    <div className="font-medium text-sm">{market.title}</div>
                    <div className="text-xs text-zinc-500">
                      YES: {(market.yesPrice * 100).toFixed(0)}¢ • NO: {(market.noPrice * 100).toFixed(0)}¢
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Side to Buy</label>
              <Controller
                name="side"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                    {(["YES", "NO"] as const).map(side => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => field.onChange(side)}
                        className={`flex-1 py-2 text-sm font-bold transition-all ${
                          field.value === side 
                            ? (side === "YES" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Amount per Market (USDC)</label>
              <Controller
                name="amountPerMarket"
                control={control}
                rules={{ required: "Amount is required", min: { value: 1, message: "Minimum is 1" } }}
                render={({ field }) => (
                  <div>
                    <input
                      type="number"
                      {...field}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none border border-zinc-200 dark:border-zinc-700 bg-transparent focus:border-blue-500 transition-colors"
                      placeholder="10"
                    />
                    {errors.amountPerMarket && <span className="text-xs text-rose-500 mt-1">{errors.amountPerMarket.message}</span>}
                  </div>
                )}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || selectedMarketIds.size === 0}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} fill="currentColor" />
            Execute {selectedMarketIds.size} Trades
          </button>
        </form>
      )}
    </div>
  );
}

export default function BatchTrading() {
  return (
    <ErrorBoundary level="component">
      <BatchTradingInner />
    </ErrorBoundary>
  );
}
