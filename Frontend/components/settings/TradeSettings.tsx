"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/useToast";

export interface TradeSettingsData {
  slippageTolerance: number;
  transactionDeadline: number;
  autoApprove: boolean;
  confirmLargeTrades: boolean;
  largeTradeThreshold: number;
}

interface TradeSettingsProps {
  initialSettings?: Partial<TradeSettingsData>;
  onSave?: (settings: TradeSettingsData) => void | Promise<void>;
  onCancel?: () => void;
}

const DEFAULT_SETTINGS: TradeSettingsData = {
  slippageTolerance: 0.5,
  transactionDeadline: 20,
  autoApprove: false,
  confirmLargeTrades: true,
  largeTradeThreshold: 1000,
};

export default function TradeSettings({
  initialSettings,
  onSave,
  onCancel,
}: TradeSettingsProps) {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [slippageWarning, setSlippageWarning] = useState<string>("");

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<TradeSettingsData>({
    defaultValues: {
      ...DEFAULT_SETTINGS,
      ...initialSettings,
    },
  });

  const slippageValue = watch("slippageTolerance");
  const deadlineValue = watch("transactionDeadline");

  // Validate slippage and show warnings
  useEffect(() => {
    if (slippageValue < 0.1) {
      setSlippageWarning("Slippage below 0.1% may cause transaction failures");
    } else if (slippageValue > 5) {
      setSlippageWarning("High slippage tolerance may result in unfavorable prices");
    } else {
      setSlippageWarning("");
    }
  }, [slippageValue]);

  const onSubmit = useCallback(
    async (data: TradeSettingsData) => {
      setIsSaving(true);
      try {
        await onSave?.(data);
        toast.success("Settings Saved", "Trade settings have been updated");
        reset(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save settings";
        toast.error("Save Failed", message);
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, toast, reset]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Slippage Tolerance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label
            htmlFor="slippage"
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Slippage Tolerance
          </label>
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: "var(--border)", color: "var(--muted)" }}
          >
            {slippageValue}%
          </span>
        </div>

        <Controller
          name="slippageTolerance"
          control={control}
          rules={{
            required: "Slippage tolerance is required",
            min: { value: 0.01, message: "Minimum slippage is 0.01%" },
            max: { value: 50, message: "Maximum slippage is 50%" },
          }}
          render={({ field }) => (
            <div className="space-y-2">
              <input
                {...field}
                id="slippage"
                type="range"
                min="0.01"
                max="50"
                step="0.1"
                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  background: "var(--border)",
                  accentColor: "#3b82f6",
                }}
              />
              <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>0.01%</span>
                <span>50%</span>
              </div>
            </div>
          )}
        />

        {slippageWarning && (
          <div
            className="p-2 rounded-lg text-xs"
            style={{
              background: "#f59e0b18",
              color: "#f59e0b",
              border: "1px solid #f59e0b44",
            }}
          >
            ⚠️ {slippageWarning}
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          The maximum percentage price change you'll accept during a trade. Higher values
          increase the chance of execution but may result in worse prices.
        </p>
      </div>

      {/* Transaction Deadline */}
      <div className="space-y-3">
        <label
          htmlFor="deadline"
          className="text-sm font-medium"
          style={{ color: "var(--foreground)" }}
        >
          Transaction Deadline
        </label>

        <Controller
          name="transactionDeadline"
          control={control}
          rules={{
            required: "Transaction deadline is required",
            min: { value: 1, message: "Minimum deadline is 1 minute" },
            max: { value: 60, message: "Maximum deadline is 60 minutes" },
          }}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <input
                {...field}
                id="deadline"
                type="number"
                onChange={(e) => field.onChange(parseInt(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <span style={{ color: "var(--muted)" }}>minutes</span>
            </div>
          )}
        />

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          How long a transaction can remain pending before it's automatically cancelled.
          Prevents stale transactions from executing at unfavorable prices.
        </p>
      </div>

      {/* Auto Approve */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label
              htmlFor="autoApprove"
              className="text-sm font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Auto-Approve Transactions
            </label>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Automatically approve token spending without confirmation
            </p>
          </div>

          <Controller
            name="autoApprove"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  field.value ? "bg-blue-600" : "bg-gray-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    field.value ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            )}
          />
        </div>
      </div>

      {/* Confirm Large Trades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label
              htmlFor="confirmLarge"
              className="text-sm font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Confirm Large Trades
            </label>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Require confirmation for trades exceeding the threshold
            </p>
          </div>

          <Controller
            name="confirmLargeTrades"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  field.value ? "bg-blue-600" : "bg-gray-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    field.value ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            )}
          />
        </div>
      </div>

      {/* Large Trade Threshold */}
      <div className="space-y-3">
        <label
          htmlFor="threshold"
          className="text-sm font-medium"
          style={{ color: "var(--foreground)" }}
        >
          Large Trade Threshold
        </label>

        <Controller
          name="largeTradeThreshold"
          control={control}
          rules={{
            required: "Threshold is required",
            min: { value: 1, message: "Minimum threshold is $1" },
          }}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--muted)" }}>$</span>
              <input
                {...field}
                id="threshold"
                type="number"
                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          )}
        />

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Trades above this amount will require confirmation if "Confirm Large Trades" is enabled.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          type="submit"
          disabled={!isDirty || isSaving}
          className={[
            "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            isDirty && !isSaving
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
