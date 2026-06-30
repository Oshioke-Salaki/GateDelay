"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradeMemoProps {
    /** Trade/transaction ID to associate the memo with */
    tradeId?: string;
    /** Initial memo value */
    initialMemo?: string;
    /** Callback when memo is saved */
    onSave?: (memo: string) => void;
    /** Callback when memo is deleted */
    onDelete?: () => void;
    /** Whether to show memo in read-only mode */
    readOnly?: boolean;
    /** Placeholder text for memo input */
    placeholder?: string;
    /** Max character limit for memo */
    maxLength?: number;
}

interface MemoFormData {
    memo: string;
}

// ─── Trade Memo Component ─────────────────────────────────────────────────────

export default function TradeMemo({
    tradeId,
    initialMemo = "",
    onSave,
    onDelete,
    readOnly = false,
    placeholder = "Add a note to this trade...",
    maxLength = 500,
}: TradeMemoProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [memo, setMemo] = useState(initialMemo);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<MemoFormData>({
        defaultValues: {
            memo: initialMemo,
        },
    });

    const watchedMemo = watch("memo");

    // Update local memo state when initialMemo changes
    useEffect(() => {
        setMemo(initialMemo);
        reset({ memo: initialMemo });
    }, [initialMemo, reset]);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleSave = async (data: MemoFormData) => {
        setIsSaving(true);
        try {
            // Mock save - in production, persist to localStorage or API
            if (tradeId) {
                // Save to localStorage as fallback
                const memos = JSON.parse(localStorage.getItem("tradeMemos") || "{}");
                memos[tradeId] = data.memo;
                localStorage.setItem("tradeMemos", JSON.stringify(memos));
            }

            setMemo(data.memo);
            setIsEditing(false);
            onSave?.(data.memo);
        } catch (error) {
            console.error("Failed to save memo:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsSaving(true);
        try {
            // Mock delete - in production, remove from storage/API
            if (tradeId) {
                const memos = JSON.parse(localStorage.getItem("tradeMemos") || "{}");
                delete memos[tradeId];
                localStorage.setItem("tradeMemos", JSON.stringify(memos));
            }

            setMemo("");
            reset({ memo: "" });
            setIsEditing(false);
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete memo:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        reset({ memo });
        setIsEditing(false);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (readOnly) {
        if (!memo) return null;
        return (
            <div className="rounded-xl p-3 text-sm" style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Note</p>
                <p className="whitespace-pre-wrap break-words">{memo}</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <AnimatePresence>
                {!isEditing ? (
                    <motion.div
                        key="display"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="rounded-xl border"
                        style={{ background: "var(--background)", borderColor: "var(--border)" }}
                    >
                        {memo ? (
                            <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Note</p>
                                        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--foreground)" }}>{memo}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="rounded-lg p-1.5 text-xs font-medium transition-colors hover:opacity-80"
                                            style={{ color: "var(--muted)" }}
                                            aria-label="Edit note"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            disabled={isSaving}
                                            className="rounded-lg p-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                                            style={{ color: "#ef4444" }}
                                            aria-label="Delete note"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full rounded-xl p-3 text-left text-sm transition-colors hover:opacity-80"
                                style={{ color: "var(--muted)" }}
                            >
                                + {placeholder}
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                            <Controller
                                name="memo"
                                control={control}
                                rules={{
                                    maxLength: { value: maxLength, message: `Memo cannot exceed ${maxLength} characters` },
                                }}
                                render={({ field }) => (
                                    <textarea
                                        {...field}
                                        placeholder={placeholder}
                                        maxLength={maxLength}
                                        rows={3}
                                        className="w-full rounded-xl p-3 text-sm resize-none outline-none"
                                        style={{
                                            background: "var(--card)",
                                            color: "var(--foreground)",
                                            border: "none",
                                        }}
                                        autoFocus
                                    />
                                )}
                            />
                            <div className="px-3 pb-2 flex justify-between items-center text-xs" style={{ color: "var(--muted)" }}>
                                <span>{errors.memo ? <span style={{ color: "#ef4444" }}>{errors.memo.message}</span> : null}</span>
                                <span>{watchedMemo.length}/{maxLength}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit(handleSave)}
                                disabled={isSaving || !!errors.memo}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-80 disabled:opacity-40"
                                style={{ background: "#7c3aed" }}
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
