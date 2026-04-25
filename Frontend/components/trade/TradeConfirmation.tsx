"use client";

import { motion, AnimatePresence } from "framer-motion";

interface TradeConfirmationProps {
    isOpen: boolean;
    side: "YES" | "NO";
    amount: number;
    price: number;
    onClose: () => void;
    onConfirm: () => void;
}

export default function TradeConfirmation({
    isOpen,
    side,
    amount,
    price,
    onClose,
    onConfirm,
}: TradeConfirmationProps) {
    const shares = amount > 0 ? (amount / price).toFixed(2) : "—";
    const totalCost = amount.toFixed(2);
    const gasCostEth = 0.0018;
    const gasCostUsd = (gasCostEth * 1700).toFixed(2);
    const isLargeTrade = amount >= 1500;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    <motion.div
                        key="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="trade-confirmation-title"
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl"
                        style={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                        }}
                    >
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase font-semibold tracking-[0.24em]" style={{ color: "#7c3aed" }}>
                                    Confirm trade
                                </p>
                                <h2 id="trade-confirmation-title" className="mt-2 text-xl font-semibold">
                                    Review your order
                                </h2>
                                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                                    This confirmation prevents accidental trades and gives you one last chance to review details.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Close trade confirmation"
                                className="rounded-full p-2 transition-opacity hover:opacity-80"
                                style={{ color: "var(--muted)" }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                            <div className="grid gap-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                                        Outcome
                                    </span>
                                    <span className="font-semibold" style={{ color: side === "YES" ? "#22c55e" : "#ef4444" }}>
                                        {side}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                                        Trade amount
                                    </span>
                                    <span className="font-semibold">{totalCost} USDC</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                                        Price per share
                                    </span>
                                    <span className="font-semibold">{price.toFixed(2)} USDC</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                                        Estimated shares
                                    </span>
                                    <span className="font-semibold">{shares}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl border-t pt-3" style={{ borderColor: "var(--border)" }}>
                                    <div>
                                        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                                            Gas fee estimate
                                        </p>
                                        <p className="text-[0.82rem]" style={{ color: "var(--muted)" }}>
                                            Estimated network cost before wallet confirmation
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{gasCostEth.toFixed(4)} ETH</p>
                                        <p className="text-xs" style={{ color: "var(--muted)" }}>≈ ${gasCostUsd}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-3xl border border-amber-300/50 bg-amber-50 p-4 text-sm" style={{ borderColor: "#fde68a" }}>
                            <p className="font-semibold text-amber-800">Risk warning</p>
                            <p className="mt-2" style={{ color: "#92400e" }}>
                                {isLargeTrade
                                    ? "This is a large trade. Expect more slippage and price movement than usual. Confirm only if you intend to execute this order."
                                    : "Ensure the trade amount fits your risk tolerance. Confirm only when you are ready to execute."}
                            </p>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/80"
                                style={{
                                    borderColor: "var(--border)",
                                    background: "var(--background)",
                                    color: "var(--foreground)",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
                                style={{ background: side === "YES" ? "#22c55e" : "#ef4444" }}
                            >
                                Confirm {side} trade
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
