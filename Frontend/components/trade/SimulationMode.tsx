"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Wallet, BarChart3, Zap } from "lucide-react";
import { useToast } from "../../hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimulatedTrade {
    id: string;
    marketId: string;
    marketTitle: string;
    side: "YES" | "NO";
    amount: number;
    price: number;
    shares: number;
    timestamp: number;
    pnl?: number;
}

export interface SimulationState {
    balance: number;
    trades: SimulatedTrade[];
    isActive: boolean;
    startTime: number | null;
    pnl: number;
    totalInvested: number;
}

export interface MarketPriceUpdate {
    marketId: string;
    yesPrice: number;
    noPrice: number;
    timestamp: number;
}

export interface SimulationModeProps {
    initialBalance?: number;
    onSimulationComplete?: (state: SimulationState) => void;
    onModeChange?: (isActive: boolean) => void;
}

// ─── Simulation Store ────────────────────────────────────────────────────────

class SimulationStore {
    private listeners = new Set<(state: SimulationState) => void>();
    private state: SimulationState = {
        balance: 10000,
        trades: [],
        isActive: false,
        startTime: null,
        pnl: 0,
        totalInvested: 0,
    };

    getState() {
        return this.state;
    }

    setState(newState: Partial<SimulationState>) {
        this.state = { ...this.state, ...newState };
        this.listeners.forEach((l) => l(this.state));
    }

    subscribe(listener: (state: SimulationState) => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
            return;
        };
    }
}

const simulationStore = new SimulationStore();

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useSimulationState() {
    const [state, setState] = useState<SimulationState>(simulationStore.getState());

    useEffect(() => {
        const unsubscribe = simulationStore.subscribe((newState) => setState(newState));
        return () => unsubscribe();
    }, []);

    return state;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SimulationMode({
    initialBalance = 10000,
    onSimulationComplete,
    onModeChange,
}: SimulationModeProps) {
    const toast = useToast();
    const simulationState = useSimulationState();
    const [selectedMarket, setSelectedMarket] = useState({
        id: "1",
        title: "Will BTC exceed $100k by EOY?",
        yesPrice: 0.65,
        noPrice: 0.35,
    });
    const [amount, setAmount] = useState<string>("100");
    const [side, setSide] = useState<"YES" | "NO">("YES");

    useEffect(() => {
        if (simulationState.isActive) {
            const interval = setInterval(updatePnL, 5000);
            return () => clearInterval(interval);
        }
    }, [simulationState.isActive, simulationState.trades]);

    const updatePnL = useCallback(() => {
        const currentState = simulationStore.getState();
        const updatedTrades = currentState.trades.map((trade) => {
            const priceChange = (Math.random() - 0.5) * 0.1;
            const newPrice = trade.side === "YES" ? selectedMarket.yesPrice + priceChange : selectedMarket.noPrice - priceChange;
            const newPnl = trade.shares * (newPrice - trade.price);
            return { ...trade, pnl: newPnl };
        });

        const totalPnl = updatedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        simulationStore.setState({ ...currentState, trades: updatedTrades, pnl: totalPnl });
    }, [selectedMarket]);

    const handleStartSimulation = useCallback(() => {
        simulationStore.setState({
            balance: initialBalance,
            trades: [],
            isActive: true,
            startTime: Date.now(),
            pnl: 0,
            totalInvested: 0,
        });
        onModeChange?.(true);
        toast.success("Simulation Started", `Virtual balance: $${initialBalance.toLocaleString()}`);
    }, [initialBalance, onModeChange, toast]);

    const handleStopSimulation = useCallback(() => {
        const finalState = simulationStore.getState();
        simulationStore.setState({ isActive: false });
        onModeChange?.(false);
        onSimulationComplete?.(finalState);
        toast.info("Simulation Stopped", `Final P&L: $${finalState.pnl.toFixed(2)}`);
    }, [onSimulationComplete, onModeChange, toast]);

    const handleReset = useCallback(() => {
        simulationStore.setState({
            balance: initialBalance,
            trades: [],
            isActive: false,
            startTime: null,
            pnl: 0,
            totalInvested: 0,
        });
    }, [initialBalance]);

    const handleExecuteTrade = useCallback(() => {
        const tradeAmount = parseFloat(amount) || 0;
        if (tradeAmount <= 0 || tradeAmount > simulationState.balance) return;

        const price = side === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice;
        const shares = tradeAmount / price;

        const newTrade: SimulatedTrade = {
            id: `trade-${Date.now()}`,
            marketId: selectedMarket.id,
            marketTitle: selectedMarket.title,
            side,
            amount: tradeAmount,
            price,
            shares,
            timestamp: Date.now(),
            pnl: 0,
        };

        simulationStore.setState({
            balance: simulationState.balance - tradeAmount,
            trades: [...simulationState.trades, newTrade],
            totalInvested: simulationState.totalInvested + tradeAmount,
        });

        toast.success("Trade Executed", `${side} $${tradeAmount} at ${(price * 100).toFixed(0)}¢`);
    }, [amount, side, simulationState.balance, simulationState.trades, simulationState.totalInvested, selectedMarket, toast]);

    const handleToggleSide = useCallback((newSide: "YES" | "NO") => {
        setSide(newSide);
    }, []);

    const stats = useMemo(() => {
        const winRate = simulationState.trades.length > 0
            ? (simulationState.trades.filter(t => (t.pnl || 0) > 0).length / simulationState.trades.length * 100)
            : 0;

        const roi = simulationState.totalInvested > 0
            ? (simulationState.pnl / simulationState.totalInvested * 100)
            : 0;

        return {
            tradesCount: simulationState.trades.length,
            winRate,
            roi,
        };
    }, [simulationState.trades, simulationState.pnl, simulationState.totalInvested]);

    return (
        <div
            className="rounded-3xl p-5 shadow-2xl"
            style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
            }}
        >
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2 bg-purple-500/10">
                        <Zap size={20} className="text-purple-500" />
                    </div>
                    <div>
                        <h3 className="font-bold">Simulation Mode</h3>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Practice trades without real funds
                        </p>
                    </div>
                </div>
                <button
                    onClick={simulationState.isActive ? handleStopSimulation : handleStartSimulation}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-white transition-opacity ${
                        !simulationState.isActive && simulationState.trades.length > 0 ? "opacity-50" : ""
                    }`}
                    style={{ background: simulationState.isActive ? "#ef4444" : "#22c55e" }}
                    disabled={!simulationState.isActive && simulationState.trades.length > 0}
                >
                    {simulationState.isActive ? (
                        <>
                            <Pause size={14} />
                            Stop
                        </>
                    ) : (
                        <>
                            <Play size={14} />
                            Start
                        </>
                    )}
                </button>
            </div>

            {!simulationState.isActive && (
                <div className="mb-4 rounded-2xl border border-amber-300/50 bg-amber-50 p-4">
                    <p className="text-sm" style={{ color: "#92400e" }}>
                        Simulation mode lets you practice trading with virtual funds. Your balance and trades
                        are isolated from real transactions.
                    </p>
                </div>
            )}

            {simulationState.isActive && (
                <>
                    <div className="mb-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl p-3" style={{ background: "var(--background)" }}>
                            <div className="flex items-center gap-2">
                                <Wallet size={14} className="text-blue-500" />
                                <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Balance
                                </span>
                            </div>
                            <p className="mt-1 font-bold">${simulationState.balance.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl p-3" style={{ background: "var(--background)" }}>
                            <div className="flex items-center gap-2">
                                <BarChart3 size={14} className="text-emerald-500" />
                                <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Total P&L
                                </span>
                            </div>
                            <p className="mt-1 font-bold" style={{ color: simulationState.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                                {simulationState.pnl >= 0 ? "+" : ""}${simulationState.pnl.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                            Market
                        </p>
                        <select
                            value={selectedMarket.id}
                            onChange={(e) => {
                                const marketId = e.target.value;
                                const mockMarkets = {
                                    "1": { id: "1", title: "Will BTC exceed $100k by EOY?", yesPrice: 0.65, noPrice: 0.35 },
                                    "2": { id: "2", title: "Will ETH outperform BTC?", yesPrice: 0.55, noPrice: 0.45 },
                                    "3": { id: "3", title: "Will SOL reach $500?", yesPrice: 0.4, noPrice: 0.6 },
                                };
                                setSelectedMarket(mockMarkets[marketId as keyof typeof mockMarkets] || mockMarkets["1"]);
                            }}
                            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                            style={{
                                background: "var(--background)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                            }}
                        >
                            <option value="1">Will BTC exceed $100k by EOY?</option>
                            <option value="2">Will ETH outperform BTC?</option>
                            <option value="3">Will SOL reach $500?</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                            Trade Side
                        </p>
                        <div className="flex gap-2">
                            {(["YES", "NO"] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleToggleSide(s)}
                                    className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                                    style={{
                                        background: side === s ? (s === "YES" ? "#22c55e" : "#ef4444") : "var(--background)",
                                        color: side === s ? "#fff" : "var(--foreground)",
                                        border: `1px solid ${side === s ? "transparent" : "var(--border)"}`,
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                            Amount (USDC)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max={simulationState.balance}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                            style={{
                                background: "var(--background)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                            }}
                        />
                    </div>

                    <div className="mb-4 rounded-2xl p-3 text-xs" style={{ background: "var(--background)" }}>
                        <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Price</span>
                            <span className="font-medium">{((side === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice) * 100).toFixed(0)}¢</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Est. Shares</span>
                            <span className="font-medium">{(parseFloat(amount || "0") / (side === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice)).toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleExecuteTrade}
                        disabled={simulationState.balance < parseFloat(amount || "0")}
                        className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ background: side === "YES" ? "#22c55e" : "#ef4444" }}
                    >
                        Execute {side} Trade
                    </button>
                </>
            )}

            {simulationState.trades.length > 0 && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                            Trade History ({stats.tradesCount})
                        </p>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
                            style={{
                                background: "var(--background)",
                                color: "var(--muted)",
                            }}
                        >
                            <RotateCcw size={12} />
                            Reset
                        </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {simulationState.trades.slice(-5).reverse().map((trade) => (
                            <div
                                key={trade.id}
                                className="rounded-xl p-2.5 text-xs"
                                style={{ background: "var(--background)" }}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold" style={{ color: trade.side === "YES" ? "#22c55e" : "#ef4444" }}>
                                        {trade.side} ${trade.amount}
                                    </span>
                                    <span style={{ color: trade.pnl !== undefined && trade.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                                        {trade.pnl !== undefined && (trade.pnl >= 0 ? "+" : "")}${trade.pnl?.toFixed(2) || "0.00"}
                                    </span>
                                </div>
                                <p className="mt-1 truncate" style={{ color: "var(--muted)" }}>
                                    {trade.marketTitle}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span style={{ color: "var(--muted)" }}>Win Rate:</span>
                            <span className="ml-1 font-semibold">{stats.winRate.toFixed(0)}%</span>
                        </div>
                        <div>
                            <span style={{ color: "var(--muted)" }}>ROI:</span>
                            <span className="ml-1 font-semibold" style={{ color: stats.roi >= 0 ? "#22c55e" : "#ef4444" }}>
                                {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}