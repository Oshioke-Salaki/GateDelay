"use client";

import React, { useState, useEffect, useMemo } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, ShieldCheck } from "lucide-react";

export interface CloseConfirmationProps {
    /** Whether the confirmation modal is visible */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Callback when close is confirmed with the selected shares count, calculated P&L, and closing fee */
    onConfirm: (sharesToClose: number, pnl: number, fee: number) => Promise<void> | void;
    /** Details of the position to close */
    position: {
        id: string;
        marketName: string;
        side: "YES" | "NO" | "long" | "short";
        shares: number;
        entryPrice: number;
        currentPrice: number;
    };
    /** Percentage fee charged for closing trades (default is 2% = 0.02) */
    feePercentage?: number;
}

export default function CloseConfirmation({
    isOpen,
    onClose,
    onConfirm,
    position,
    feePercentage = 0.02,
}: CloseConfirmationProps) {
    // ─── Component State ──────────────────────────────────────────────────────
    const [closePercentage, setClosePercentage] = useState<number>(100);
    const [closeSharesInput, setCloseSharesInput] = useState<string>(position.shares.toString());
    const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Synchronize react-modal setup for accessibility in Next.js/SSR
    useEffect(() => {
        if (typeof window !== "undefined") {
            Modal.setAppElement("body");
        }
    }, []);

    // Reset fields when the modal opens or the position changes
    useEffect(() => {
        if (isOpen) {
            setClosePercentage(100);
            setCloseSharesInput(position.shares.toString());
            setIsConfirmed(false);
            setIsSubmitting(false);
        }
    }, [isOpen, position]);

    // ─── Financial Calculations ───────────────────────────────────────────────
    // Parse shares to close safely, capping at the maximum owned shares
    const sharesToClose = useMemo(() => {
        const parsed = parseFloat(closeSharesInput) || 0;
        return Math.min(position.shares, Math.max(0, parsed));
    }, [closeSharesInput, position.shares]);

    const isYes = position.side === "YES" || position.side === "long";

    // P&L calculation: (currentPrice - entryPrice) * shares
    const pnl = useMemo(() => {
        const singlePnl = position.currentPrice - position.entryPrice;
        return singlePnl * sharesToClose;
    }, [position.currentPrice, position.entryPrice, sharesToClose]);

    // Cost basis of the closed portion
    const costBasis = useMemo(() => {
        return sharesToClose * position.entryPrice;
    }, [sharesToClose, position.entryPrice]);

    // P&L percentage based on cost basis
    const pnlPct = useMemo(() => {
        if (costBasis === 0) return 0;
        return (pnl / costBasis) * 100;
    }, [pnl, costBasis]);

    // Closed portion's market value
    const closingValue = useMemo(() => {
        return sharesToClose * position.currentPrice;
    }, [sharesToClose, position.currentPrice]);

    // Transaction closing fee (default 2% of the closing market value)
    const closingFee = useMemo(() => {
        return closingValue * feePercentage;
    }, [closingValue, feePercentage]);

    // Net payout returned to the user's wallet
    const netPayout = useMemo(() => {
        return Math.max(0, closingValue - closingFee);
    }, [closingValue, closingFee]);

    // Remaining position stats after partial closing
    const remainingShares = useMemo(() => {
        return Math.max(0, position.shares - sharesToClose);
    }, [position.shares, sharesToClose]);

    const remainingValue = useMemo(() => {
        return remainingShares * position.currentPrice;
    }, [remainingShares, position.currentPrice]);

    // ─── Change Handlers ──────────────────────────────────────────────────────
    // Handler for the quick percentage buttons (25%, 50%, etc.)
    const handlePctSelect = (pct: number) => {
        setClosePercentage(pct);
        const calculatedShares = (position.shares * (pct / 100));
        // Format to max 4 decimal places for precision without clutter
        setCloseSharesInput(parseFloat(calculatedShares.toFixed(4)).toString());
    };

    // Handler for the range slider
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pct = parseInt(e.target.value, 10);
        setClosePercentage(pct);
        const calculatedShares = (position.shares * (pct / 100));
        setCloseSharesInput(parseFloat(calculatedShares.toFixed(4)).toString());
    };

    // Handler for the manual shares input field
    const handleSharesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCloseSharesInput(val);

        const parsed = parseFloat(val) || 0;
        if (parsed > 0 && position.shares > 0) {
            const pct = Math.min(100, Math.max(0, (parsed / position.shares) * 100));
            setClosePercentage(Math.round(pct));
        } else {
            setClosePercentage(0);
        }
    };

    // Form submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConfirmed || sharesToClose <= 0 || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onConfirm(sharesToClose, pnl, closingFee);
        } catch (error) {
            console.error("Failed to confirm position close:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel="Close Position Confirmation"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none"
            overlayClassName="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center"
            style={{
                content: {
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                },
            }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
                        <div>
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em]" style={{ color: "#7c3aed" }}>
                                Close Position
                            </span>
                            <h2 className="text-lg font-bold mt-0.5">Confirm Closing Position</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ color: "var(--muted)" }}
                            aria-label="Close dialog"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Position Summary Card */}
                    <div className="rounded-2xl p-4 mb-4 border" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-semibold truncate max-w-[70%]" style={{ color: "var(--foreground)" }}>
                                {position.marketName}
                            </span>
                            <span
                                className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                                style={{
                                    background: isYes ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                                    color: isYes ? "#22c55e" : "#ef4444",
                                    border: `1px solid ${isYes ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                                }}
                            >
                                {position.side.toUpperCase()}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                                <span style={{ color: "var(--muted)" }}>Total Shares</span>
                                <p className="font-semibold font-mono mt-0.5">{position.shares.toFixed(2)}</p>
                            </div>
                            <div>
                                <span style={{ color: "var(--muted)" }}>Entry Price</span>
                                <p className="font-semibold font-mono mt-0.5">${position.entryPrice.toFixed(4)}</p>
                            </div>
                            <div>
                                <span style={{ color: "var(--muted)" }}>Current Price</span>
                                <p className="font-semibold font-mono mt-0.5">${position.currentPrice.toFixed(4)}</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Partial Close Interactive Section */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                                    Shares to Close
                                </label>
                                <span className="text-xs" style={{ color: "var(--muted)" }}>
                                    Max: <span className="font-semibold font-mono">{position.shares.toFixed(2)}</span>
                                </span>
                            </div>

                            <div className="relative flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    max={position.shares}
                                    step="0.0001"
                                    value={closeSharesInput}
                                    onChange={handleSharesInputChange}
                                    className="w-full px-3 py-2 rounded-xl border font-mono text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                                    style={{
                                        background: "var(--background)",
                                        borderColor: "var(--border)",
                                        color: "var(--foreground)",
                                    }}
                                />
                                <span className="absolute right-3 text-xs font-semibold" style={{ color: "var(--muted)" }}>
                                    {closePercentage}%
                                </span>
                            </div>

                            {/* Percentage slider */}
                            <div className="pt-2 flex items-center gap-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={closePercentage}
                                    onChange={handleSliderChange}
                                    className="w-full accent-purple-600 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
                                />
                            </div>

                            {/* Shortcut percentage pills */}
                            <div className="grid grid-cols-4 gap-2 pt-1">
                                {[25, 50, 75, 100].map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handlePctSelect(pct)}
                                        className={`py-1 px-2 rounded-xl text-xs font-semibold border transition-all ${
                                            closePercentage === pct
                                                ? "border-purple-600 bg-purple-600/10 text-purple-600"
                                                : "border-zinc-200 dark:border-zinc-700 hover:bg-black/5 dark:hover:bg-white/5"
                                        }`}
                                        style={{
                                            color: closePercentage === pct ? "#7c3aed" : "var(--muted)",
                                            borderColor: closePercentage === pct ? "#7c3aed" : "var(--border)",
                                        }}
                                    >
                                        {pct === 100 ? "Max" : `${pct}%`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Financial Breakdowns */}
                        <div className="rounded-2xl border p-4 space-y-2.5 text-xs" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                            <div className="flex justify-between items-center">
                                <span style={{ color: "var(--muted)" }}>Portion Value</span>
                                <span className="font-semibold font-mono">${closingValue.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span style={{ color: "var(--muted)" }}>Unrealized P&L ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                                <span
                                    className="font-bold font-mono"
                                    style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}
                                >
                                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span style={{ color: "var(--muted)" }}>Closing Fee ({feePercentage * 100}%)</span>
                                <span className="font-semibold font-mono text-red-500">-${closingFee.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t font-semibold" style={{ borderColor: "var(--border)" }}>
                                <span style={{ color: "var(--foreground)" }}>Estimated Net Refund</span>
                                <span className="font-bold font-mono text-sm" style={{ color: "#22c55e" }}>
                                    ${netPayout.toFixed(2)}
                                </span>
                            </div>

                            {remainingShares > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-dashed" style={{ borderColor: "var(--border)" }}>
                                    <span style={{ color: "var(--muted)" }}>Remaining Position</span>
                                    <span className="font-mono text-zinc-500 dark:text-zinc-400">
                                        {remainingShares.toFixed(2)} shares (~${remainingValue.toFixed(2)})
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Accident Prevention warning box */}
                        <div
                            className="rounded-2xl p-3 border text-xs flex gap-2.5"
                            style={{
                                background: "rgba(245, 158, 11, 0.08)",
                                borderColor: "rgba(245, 158, 11, 0.2)",
                                color: "#d97706",
                            }}
                        >
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Important Notice</p>
                                <p className="mt-0.5 leading-relaxed opacity-90">
                                    Closing this position will immediately settle the selected share count. Settle values are subject to market conditions at the time of execution.
                                </p>
                            </div>
                        </div>

                        {/* Explicit switch confirmation */}
                        <div
                            className="rounded-2xl p-3 border transition-colors flex items-start gap-3 cursor-pointer"
                            style={{
                                background: isConfirmed ? "rgba(34,197,94,0.06)" : "var(--background)",
                                borderColor: isConfirmed ? "rgba(34,197,94,0.3)" : "var(--border)",
                            }}
                            onClick={() => setIsConfirmed(!isConfirmed)}
                        >
                            <input
                                type="checkbox"
                                id="explicit-confirm"
                                checked={isConfirmed}
                                onChange={(e) => setIsConfirmed(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded accent-purple-600 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <label
                                htmlFor="explicit-confirm"
                                className="text-xs font-medium leading-relaxed select-none cursor-pointer"
                                style={{ color: isConfirmed ? "var(--foreground)" : "var(--muted)" }}
                                onClick={(e) => e.preventDefault()} // fully handled by parent onClick
                            >
                                I understand that closing this position settled at market price is final and irreversible.
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                                style={{
                                    background: "var(--background)",
                                    borderColor: "var(--border)",
                                    color: "var(--foreground)",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isConfirmed || sharesToClose <= 0 || isSubmitting}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-30 disabled:pointer-events-none"
                                style={{
                                    background: isYes ? "#22c55e" : "#ef4444",
                                }}
                            >
                                {isSubmitting ? "Settling..." : `Settle Position`}
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </Modal>
        );
}
