"use client";

import { useState, useEffect } from "react";

// Mock asset metadata matching 1inch cross-chain support profiles
type Token = { symbol: string; name: string; decimals: number; chain: string; balance: string };

const AVAILABLE_TOKENS: Token[] = [
  { symbol: "ETH", name: "Ethereum", decimals: 18, chain: "Ethereum", balance: "1.45" },
  { symbol: "USDC", name: "USD Coin", decimals: 6, chain: "Ethereum", balance: "420.00" },
  { symbol: "BNB", name: "BNB", decimals: 18, chain: "BSC", balance: "3.22" },
  { symbol: "MATIC", name: "Polygon", decimals: 18, chain: "Polygon", balance: "128.50" },
];

type Route = { id: string; provider: string; expectedOutput: string; gasFeeUsd: number; durationSec: number };

export default function CrossChainSwap() {
  // Token State Selection Layer
  const [sourceToken, setSourceToken] = useState<Token>(AVAILABLE_TOKENS[0]);
  const [targetToken, setTargetToken] = useState<Token>(AVAILABLE_TOKENS[2]);
  const [swapAmount, setSwapAmount] = useState<string>("");

  // Live Rates and Routes State Tracker
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isFetchingRates, setIsFetchingRates] = useState<boolean>(false);

  // Workflow Pipeline Lifecycle States
  const [swapStatus, setSwapStatus] = useState<"idle" | "approving" | "swapping" | "success" | "failed">("idle");
  const [swapProgress, setSwapProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Live real-time pricing recalculation simulation engine (1inch fallback mock)
  useEffect(() => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      setRoutes([]);
      setSelectedRoute(null);
      return;
    }

    setIsFetchingRates(true);
    const delayDebounce = setTimeout(() => {
      const parsedAmount = parseFloat(swapAmount) || 0;
      // Simulated live calculation shifts across different providers
      const generatedRoutes: Route[] = [
        {
          id: "1inch-best",
          provider: "1inch Aggregator (Best Rate)",
          expectedOutput: (parsedAmount * 5.842).toFixed(4),
          gasFeeUsd: 4.25,
          durationSec: 45,
        },
        {
          id: "paraswap",
          provider: "ParaSwap Route",
          expectedOutput: (parsedAmount * 5.811).toFixed(4),
          gasFeeUsd: 6.10,
          durationSec: 30,
        },
      ];

      setRoutes(generatedRoutes);
      setSelectedRoute(generatedRoutes[0]);
      setIsFetchingRates(false);
    }, 600); // Debounce timing limits rapid request overhead

    return () => clearTimeout(delayDebounce);
  }, [swapAmount, sourceToken, targetToken]);

  // Handle transaction progress sequence steps
  const executeCrossChainSwap = async () => {
    if (!selectedRoute || !swapAmount) return;

    try {
      // Step 1: Approve Smart Contract Access to Funds
      setSwapStatus("approving");
      setSwapProgress(15);
      setStatusMessage(`Granting smart contract permission to manage ${sourceToken.symbol}...`);
      await new Promise((res) => setTimeout(res, 2000));

      // Step 2: Push Multi-Chain Routing Step
      setSwapStatus("swapping");
      setSwapProgress(45);
      setStatusMessage(`Initiating bridge route from ${sourceToken.chain} to ${targetToken.chain} via ${selectedRoute.provider}...`);
      
      // Simulate gradual transaction confirmation increments
      for (let p = 55; p <= 90; p += 15) {
        await new Promise((res) => setTimeout(res, 1500));
        setSwapProgress(p);
        if (p === 70) setStatusMessage("Waiting for validation signatures from bridge validators...");
        if (p === 85) setStatusMessage(`Funds landed on ${targetToken.chain}. Compiling terminal swap distribution...`);
      }

      setSwapProgress(100);
      setSwapStatus("success");
      setStatusMessage(`Swap completed cleanly! Received ${selectedRoute.expectedOutput} ${targetToken.symbol}.`);
    } catch (err) {
      setSwapStatus("failed");
      setStatusMessage("Cross-chain pipeline failed due to network timeout limits. Please try again.");
    }
  };

  const resetSwapLayout = () => {
    setSwapAmount("");
    setSwapStatus("idle");
    setSwapProgress(0);
    setStatusMessage("");
  };

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 shadow-2xl">
      <h2 className="text-xl font-bold mb-6 text-emerald-400 tracking-tight">Cross-Chain Swap Routes</h2>

      {swapStatus === "idle" ? (
        <>
          {/* Swap Currency Input Segment Layout */}
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pay From ({sourceToken.chain})</label>
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="0.0"
                  className="w-full bg-transparent text-2xl font-medium outline-none text-slate-100 placeholder-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                />
                <select
                  className="bg-slate-800 px-3 py-1 rounded-lg font-bold border border-slate-700 outline-none cursor-pointer"
                  value={sourceToken.symbol}
                  onChange={(e) => setSourceToken(AVAILABLE_TOKENS.find(t => t.symbol === e.target.value) || AVAILABLE_TOKENS[0])}
                >
                  {AVAILABLE_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <div className="text-xs text-slate-500 mt-2 text-right">Balance: {sourceToken.balance}</div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Receive To ({targetToken.chain})</label>
              <div className="flex gap-4">
                <div className="w-full text-2xl font-medium text-slate-400">
                  {isFetchingRates ? "..." : selectedRoute ? selectedRoute.expectedOutput : "0.0"}
                </div>
                <select
                  className="bg-slate-800 px-3 py-1 rounded-lg font-bold border border-slate-700 outline-none cursor-pointer"
                  value={targetToken.symbol}
                  onChange={(e) => setTargetToken(AVAILABLE_TOKENS.find(t => t.symbol === e.target.value) || AVAILABLE_TOKENS[2])}
                >
                  {AVAILABLE_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <div className="text-xs text-slate-500 mt-2 text-right">Balance: {targetToken.balance}</div>
            </div>
          </div>

          {/* Real-time liquidity route selection box layout */}
          {routes.length > 0 && (
            <div className="mb-6 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Swap Routes</h3>
              {routes.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                    selectedRoute?.id === r.id
                      ? "bg-slate-950 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                      : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-200">{r.provider}</div>
                    <div className="text-xs text-slate-500 mt-1">Est. Time: ~{r.durationSec}s • Gas Fee: ${r.gasFeeUsd.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">{r.expectedOutput}</span>{" "}
                    <span className="text-xs text-slate-400">{targetToken.symbol}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={executeCrossChainSwap}
            disabled={!swapAmount || parseFloat(swapAmount) <= 0 || isFetchingRates}
            className="w-full py-4 rounded-xl font-bold tracking-wide transition-all bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
          >
            {isFetchingRates ? "Fetching Optimal Rates..." : "Execute Cross-Chain Swap"}
          </button>
        </>
      ) : (
        /* Real-Time Swap Transaction Status & Progress Module */
        <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-6 text-center">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-400">
            <span className="capitalize text-emerald-400 font-bold">{swapStatus}...</span>
            <span>{swapProgress}%</span>
          </div>

          {/* Standard progress bar tracker tracks layout transformations safely */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${swapProgress}%` }}
            />
          </div>

          <p className="text-sm text-slate-300 leading-relaxed min-h-[40px] px-2">{statusMessage}</p>

          {swapStatus === "success" && (
            <button
              onClick={resetSwapLayout}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl transition-all border border-slate-700"
            >
              Make Another Swap
            </button>
          )}
        </div>
      )}
    </div>
  );
}