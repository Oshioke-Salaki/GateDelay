"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/useToast";

interface WithdrawalFormProps {
  availableBalance?: number;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  withdrawalFeePercent?: number;
  estimatedTime?: string;
  onSubmit?: (data: WithdrawalFormData) => Promise<void>;
}

interface WithdrawalFormData {
  amount: number;
  destination: string;
}

export default function WithdrawalForm({
  availableBalance = 1500.5,
  minWithdrawal = 10,
  maxWithdrawal = 50000,
  withdrawalFeePercent = 0.5,
  estimatedTime = "2-4 hours",
  onSubmit,
}: WithdrawalFormProps) {
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState<WithdrawalFormData | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<WithdrawalFormData>({
    defaultValues: {
      amount: 0,
      destination: "",
    },
  });

  const amount = watch("amount");
  const destination = watch("destination");

  const withdrawalFee = amount * (withdrawalFeePercent / 100);
  const netAmount = amount - withdrawalFee;
  const isValidAmount = amount >= minWithdrawal && amount <= maxWithdrawal && amount <= availableBalance;

  const handleFormSubmit = useCallback(
    async (data: WithdrawalFormData) => {
      if (!isValidAmount) {
        error("Invalid amount", `Amount must be between $${minWithdrawal} and $${Math.min(maxWithdrawal, availableBalance)}`);
        return;
      }

      if (!destination.trim()) {
        error("Invalid destination", "Please enter a valid destination address");
        return;
      }

      setPendingData(data);
      setShowConfirmation(true);
    },
    [isValidAmount, destination, minWithdrawal, maxWithdrawal, availableBalance, error],
  );

  const handleConfirmWithdrawal = useCallback(async () => {
    if (!pendingData) return;

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(pendingData);
      }
      success("Withdrawal initiated", `$${pendingData.amount.toFixed(2)} will be withdrawn to your account`);
      reset();
      setPendingData(null);
      setShowConfirmation(false);
    } catch (err) {
      error("Withdrawal failed", (err as Error).message || "Could not process withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingData, onSubmit, success, error, reset]);

  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl p-6"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Available Balance
        </p>
        <p className="mt-2 text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          ${availableBalance.toFixed(2)}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Minimum withdrawal: ${minWithdrawal} | Maximum: ${maxWithdrawal.toLocaleString()}
        </p>
      </motion.div>

      {/* Withdrawal Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-4 rounded-xl p-6"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Withdrawal Amount
          </label>
          <div className="relative mt-2">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold"
              style={{ color: "var(--muted)" }}
            >
              $
            </span>
            <input
              type="number"
              step="0.01"
              min={minWithdrawal}
              max={Math.min(maxWithdrawal, availableBalance)}
              placeholder="0.00"
              {...register("amount", {
                required: "Amount is required",
                min: {
                  value: minWithdrawal,
                  message: `Minimum withdrawal is $${minWithdrawal}`,
                },
                max: {
                  value: Math.min(maxWithdrawal, availableBalance),
                  message: `Maximum withdrawal is $${Math.min(maxWithdrawal, availableBalance)}`,
                },
              })}
              className="w-full rounded-lg border px-4 py-3 pl-8 text-lg font-semibold transition-colors focus:outline-none focus:ring-2"
              style={{
                background: "var(--background)",
                borderColor: errors.amount ? "#ef4444" : "var(--border)",
                color: "var(--foreground)",
                "--tw-ring-color": "#667eea",
              } as React.CSSProperties}
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.amount.message}
            </p>
          )}

          {/* Quick Amount Buttons */}
          <div className="mt-3 flex gap-2">
            {[25, 50, 100].map((quickAmount) => (
              <button
                key={quickAmount}
                type="button"
                onClick={() => {
                  const value = Math.min(quickAmount, availableBalance);
                  const input = document.querySelector(
                    'input[type="number"]',
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = value.toString();
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:opacity-80 active:scale-95"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                ${quickAmount}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const input = document.querySelector(
                  'input[type="number"]',
                ) as HTMLInputElement;
                if (input) {
                  input.value = availableBalance.toString();
                  input.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:opacity-80 active:scale-95"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              Max
            </button>
          </div>
        </div>

        {/* Destination Input */}
        <div>
          <label className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Destination Address
          </label>
          <input
            type="text"
            placeholder="Enter wallet or bank account address"
            {...register("destination", {
              required: "Destination is required",
              minLength: {
                value: 5,
                message: "Invalid destination address",
              },
            })}
            className="mt-2 w-full rounded-lg border px-4 py-3 transition-colors focus:outline-none focus:ring-2"
            style={{
              background: "var(--background)",
              borderColor: errors.destination ? "#ef4444" : "var(--border)",
              color: "var(--foreground)",
              "--tw-ring-color": "#667eea",
            } as React.CSSProperties}
          />
          {errors.destination && (
            <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
              {errors.destination.message}
            </p>
          )}
        </div>

        {/* Fee Breakdown */}
        {amount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 rounded-lg p-3"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Withdrawal Amount:</span>
              <span style={{ color: "var(--foreground)" }}>${amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Withdrawal Fee ({withdrawalFeePercent}%):</span>
              <span style={{ color: "#ef4444" }}>-${withdrawalFee.toFixed(2)}</span>
            </div>
            <div
              className="border-t pt-2"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex justify-between text-sm font-semibold">
                <span style={{ color: "var(--muted)" }}>You will receive:</span>
                <span style={{ color: "#10b981" }}>${netAmount.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info Section */}
        <div
          className="flex gap-3 rounded-lg p-3"
          style={{
            background: "rgba(102, 126, 234, 0.1)",
            border: "1px solid rgba(102, 126, 234, 0.2)",
          }}
        >
          <Clock size={18} style={{ color: "#667eea", flexShrink: 0 }} />
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              Estimated Processing Time
            </p>
            <p className="mt-1">{estimatedTime}</p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isValidAmount || !destination.trim()}
          className="w-full rounded-lg px-4 py-3 font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          {isSubmitting ? "Processing..." : "Review Withdrawal"}
        </button>
      </motion.form>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && pendingData && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSubmitting && setShowConfirmation(false)}
              aria-hidden="true"
            />

            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="mb-4 text-center">
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "rgba(102, 126, 234, 0.1)" }}
                >
                  <AlertCircle size={24} style={{ color: "#667eea" }} />
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Confirm Withdrawal
                </h2>
              </div>

              <div className="mb-6 space-y-3 rounded-lg p-4" style={{ background: "var(--background)" }}>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Amount:</span>
                  <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                    ${pendingData.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Fee:</span>
                  <span style={{ color: "#ef4444" }}>
                    -${(pendingData.amount * (withdrawalFeePercent / 100)).toFixed(2)}
                  </span>
                </div>
                <div
                  className="border-t pt-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex justify-between">
                    <span style={{ color: "var(--muted)" }}>You receive:</span>
                    <span className="font-bold" style={{ color: "#10b981" }}>
                      ${(pendingData.amount - pendingData.amount * (withdrawalFeePercent / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>To:</span>
                  <span
                    className="truncate font-mono text-xs"
                    style={{ color: "var(--foreground)" }}
                    title={pendingData.destination}
                  >
                    {pendingData.destination}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg px-4 py-2 font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWithdrawal}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg px-4 py-2 font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "#10b981",
                    color: "white",
                  }}
                >
                  {isSubmitting ? "Processing..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
