"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSignTypedData, useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, FileSignature, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "../../hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignatureStatus = "idle" | "pending" | "signing" | "success" | "error" | "rejected";

export interface TradeSignature {
    id: string;
    marketId: string;
    marketTitle: string;
    side: "YES" | "NO";
    amount: number;
    price: number;
    estimatedShares: number;
    deadline: number;
    createdAt: number;
}

export interface SignatureRequestProps {
    request: TradeSignature;
    onSign?: (request: TradeSignature, signature: string) => void;
    onReject?: (request: TradeSignature) => void;
    onStatusChange?: (status: SignatureStatus) => void;
    autoOpen?: boolean;
}

// ─── Default Values ───────────────────────────────────────────────────────────

const SIGNATURE_TYPES = {
    TradeSignature: [
        { name: "marketId", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "amount", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "estimatedShares", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "bytes32" },
    ],
} as const;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SignatureRequest({
    request,
    onSign,
    onReject,
    onStatusChange,
    autoOpen = false,
}: SignatureRequestProps) {
    const { isConnected, address } = useAccount();
    const toast = useToast();
    const [status, setStatus] = useState<SignatureStatus>("idle");
    const [isOpen, setIsOpen] = useState(autoOpen);

    const { signTypedData, isPending: isSigning, error: signError, data: signature, reset: resetSign } = useSignTypedData();

    useEffect(() => {
        if (signature) {
            setStatus("success");
            onSign?.(request, signature);
            onStatusChange?.("success");
        }
    }, [signature, request, onSign, onStatusChange]);

    useEffect(() => {
        if (signError) {
            const errorMsg = signError.message || "";
            if (errorMsg.includes("User rejected") || errorMsg.includes("rejected the request")) {
                setStatus("rejected");
                onReject?.(request);
                onStatusChange?.("rejected");
            } else {
                setStatus("error");
                onStatusChange?.("error");
            }
            toast.error("Signature Failed", errorMsg || "Failed to sign trade request");
        }
    }, [signError, request, onReject, onStatusChange, toast]);

    const handleSign = useCallback(() => {
        if (!isConnected || !address) {
            toast.error("Wallet Not Connected", "Please connect your wallet first");
            return;
        }

        setStatus("signing");
        onStatusChange?.("signing");

        const nonce = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}` as `0x${string}`;

        signTypedData({
            domain: {
                name: "GateDelay Trade",
                version: "1",
                chainId: 1,
                verifyingContract: "0x0000000000000000000000000000000000000000",
            },
            types: SIGNATURE_TYPES,
            primaryType: "TradeSignature",
            message: {
                marketId: BigInt(request.marketId),
                side: request.side === "YES" ? 0 : 1,
                amount: BigInt(Math.floor(request.amount * 1e6)),
                price: BigInt(Math.floor(request.price * 1e6)),
                estimatedShares: BigInt(Math.floor(request.estimatedShares * 1e18)),
                deadline: BigInt(request.deadline),
                nonce,
            },
        });
    }, [isConnected, address, signTypedData, request, onStatusChange, toast]);

    const handleReject = useCallback(() => {
        setStatus("rejected");
        onStatusChange?.("rejected");
        toast.info("Signature Rejected", "You rejected this trade signature request");
        onReject?.(request);
    }, [request, onReject, onStatusChange, toast]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setStatus("idle");
        resetSign();
    }, [resetSign]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                }}
            >
                <FileSignature size={16} />
                View Signature Request
            </button>
        );
    }

    const isBusy = status === "signing" || status === "pending";
    const isCompleted = status === "success" || status === "rejected" || status === "error";
    const timeRemaining = Math.max(0, request.deadline - Date.now() / 1000);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={!isBusy ? handleClose : undefined}
                    aria-hidden="true"
                />
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="signature-request-title"
                    className="relative z-10 w-full max-w-md rounded-3xl p-6 shadow-2xl"
                    style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                    }}
                >
                    <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl p-2 bg-blue-500/10">
                                <FileSignature size={20} className="text-blue-500" />
                            </div>
                            <h2 id="signature-request-title" className="text-xl font-bold">
                                Signature Request
                            </h2>
                        </div>
                        {!isBusy && !isCompleted && (
                            <button
                                onClick={handleClose}
                                className="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                                aria-label="Close signature request"
                            >
                                <XCircle size={18} />
                            </button>
                        )}
                    </div>

                    <div className="mb-4 rounded-2xl p-4" style={{ background: "var(--background)" }}>
                        <div className="mb-3">
                            <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                Market
                            </p>
                            <p className="mt-1 font-medium">{request.marketTitle}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Outcome
                                </p>
                                <p className="mt-1 font-semibold" style={{ color: request.side === "YES" ? "#22c55e" : "#ef4444" }}>
                                    {request.side}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Amount
                                </p>
                                <p className="mt-1 font-semibold">{request.amount} USDC</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Price
                                </p>
                                <p className="mt-1 font-semibold">{request.price.toFixed(2)} USDC/share</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                    Est. Shares
                                </p>
                                <p className="mt-1 font-semibold">{request.estimatedShares.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                            <p className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                                Expires in
                            </p>
                            <p className="mt-1 font-medium">
                                {timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}m ${Math.floor(timeRemaining % 60)}s` : "Expired"}
                            </p>
                        </div>
                    </div>

                    {isCompleted && (
                        <div
                            className="mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"
                            style={{
                                background:
                                    status === "success"
                                        ? "rgba(34,197,94,0.1)"
                                        : status === "rejected"
                                        ? "rgba(239,68,68,0.1)"
                                        : "rgba(239,68,68,0.1)",
                                border: `1px solid ${
                                    status === "success"
                                        ? "rgba(34,197,94,0.3)"
                                        : status === "rejected"
                                        ? "rgba(239,68,68,0.3)"
                                        : "rgba(239,68,68,0.3)"
                                }`,
                            }}
                        >
                            {status === "success" && <CheckCircle2 size={16} className="text-emerald-500" />}
                            {status === "rejected" && <XCircle size={16} className="text-rose-500" />}
                            {status === "error" && <AlertCircle size={16} className="text-rose-500" />}
                            <span>
                                {status === "success" && "Signature successfully created"}
                                {status === "rejected" && "You rejected this signature request"}
                                {status === "error" && "Failed to create signature"}
                            </span>
                        </div>
                    )}

                    {status === "success" && signature && (
                        <div className="mb-4 break-all rounded-xl bg-black/5 p-3 text-xs font-mono" style={{ borderColor: "var(--border)" }}>
                            <p className="mb-1 font-semibold" style={{ color: "var(--muted)" }}>
                                Signature
                            </p>
                            <p>{signature}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {!isCompleted && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isBusy}
                                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/80"
                                    style={{
                                        background: "var(--background)",
                                        border: "1px solid var(--border)",
                                        color: "var(--foreground)",
                                    }}
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSign}
                                    disabled={isBusy || !isConnected}
                                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                                    style={{ background: "#6366f1" }}
                                >
                                    {isBusy ? (
                                        <>
                                            <Loader2 size={14} className="mr-1.5 inline animate-spin" />
                                            Signing...
                                        </>
                                    ) : (
                                        "Sign Request"
                                    )}
                                </button>
                            </>
                        )}
                        {isCompleted && (
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ background: "#6366f1" }}
                            >
                                Close
                            </button>
                        )}
                    </div>

                    <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
                        Confirm this signature in your wallet to authorize the trade
                    </p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}