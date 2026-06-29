"use client";

import { useState, useMemo } from "react";

interface ProfitCalculatorProps {
  currentYesPrice?: number;
  currentNoPrice?: number;
  className?: string;
}

interface CalculationResult {
  tradeAmount: number;
  selectedOutcome: "YES" | "NO";
  entryPrice: number;
  shares: number;
  potentialPayout: number;
  profit: number;
  profitPercentage: number;
  breakeven: number;
  riskLevel: "low" | "medium" | "high";
  feeAmount: number;
  totalCost: number;
}

const FEE_PERCENTAGE = 0.02; // 2% fee

export default function ProfitCalculator({
  currentYesPrice = 0.5,
  currentNoPrice = 0.5,
  className = "",
}: ProfitCalculatorProps) {
  const [tradeAmount, setTradeAmount] = useState<number>(100);
  const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");
  const [exitPrice, setExitPrice] = useState<number>(0.7);

  const entryPrice = selectedOutcome === "YES" ? currentYesPrice : currentNoPrice;

  const calculation: CalculationResult = useMemo(() => {
    const feeAmount = tradeAmount * FEE_PERCENTAGE;
    const totalCost = tradeAmount + feeAmount;
    const shares = tradeAmount / entryPrice;
    const potentialPayout = shares * exitPrice;
    const profit = potentialPayout - totalCost;
    const profitPercentage = (profit / totalCost) * 100;
    const breakeven = totalCost / shares;

    let riskLevel: "low" | "medium" | "high" = "low";
    if (profitPercentage < -20) riskLevel = "high";
    else if (profitPercentage < 0) riskLevel = "medium";

    return {
      tradeAmount,
      selectedOutcome,
      entryPrice,
      shares,
      potentialPayout,
      profit,
      profitPercentage,
      breakeven,
      riskLevel,
      feeAmount,
      totalCost,
    };
  }, [tradeAmount, selectedOutcome, entryPrice, exitPrice]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "#22c55e";
      case "medium":
        return "#f59e0b";
      case "high":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getProfitColor = (profit: number) => {
    return profit >= 0 ? "#22c55e" : "#ef4444";
  };

  return (
    <div
      className={`rounded-xl p-6 space-y-6 ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
        Profit/Loss Calculator
      </h2>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Trade Amount */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Trade Amount (USD)
          </label>
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
            min="0"
            step="10"
          />
        </div>

        {/* Outcome Selection */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Outcome
          </label>
          <div className="flex gap-2">
            {(["YES", "NO"] as const).map((outcome) => (
              <button
                key={outcome}
                onClick={() => setSelectedOutcome(outcome)}
                className="flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background:
                    selectedOutcome === outcome
                      ? outcome === "YES"
                        ? "#22c55e28"
                        : "#ef444428"
                      : "var(--border)",
                  color: selectedOutcome === outcome ? (outcome === "YES" ? "#22c55e" : "#ef4444") : "var(--muted)",
                  border: `1px solid ${
                    selectedOutcome === outcome
                      ? outcome === "YES"
                        ? "#22c55e"
                        : "#ef4444"
                      : "var(--border)"
                  }`,
                }}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        {/* Exit Price */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Exit Price (0.00 - 1.00)
          </label>
          <input
            type="number"
            value={exitPrice}
            onChange={(e) => setExitPrice(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
            min="0"
            max="1"
            step="0.01"
          />
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Entry Price */}
        <div
          className="rounded-lg p-3"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Entry Price
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            ${calculation.entryPrice.toFixed(2)}
          </p>
        </div>

        {/* Shares */}
        <div
          className="rounded-lg p-3"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Shares
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {calculation.shares.toFixed(2)}
          </p>
        </div>

        {/* Breakeven */}
        <div
          className="rounded-lg p-3"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Breakeven Price
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            ${calculation.breakeven.toFixed(2)}
          </p>
        </div>

        {/* Total Cost */}
        <div
          className="rounded-lg p-3"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Total Cost (incl. fees)
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            ${calculation.totalCost.toFixed(2)}
          </p>
        </div>

        {/* Potential Payout */}
        <div
          className="rounded-lg p-3 col-span-2"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Potential Payout
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            ${calculation.potentialPayout.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Profit/Loss Summary */}
      <div
        className="rounded-lg p-4 space-y-2"
        style={{
          background: getProfitColor(calculation.profit) + "18",
          border: `1px solid ${getProfitColor(calculation.profit)}44`,
        }}
      >
        <div className="flex justify-between items-center">
          <span style={{ color: "var(--muted)" }}>Profit/Loss</span>
          <span
            className="text-lg font-bold"
            style={{ color: getProfitColor(calculation.profit) }}
          >
            {calculation.profit >= 0 ? "+" : ""}${calculation.profit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span style={{ color: "var(--muted)" }}>Return %</span>
          <span
            className="text-lg font-bold"
            style={{ color: getProfitColor(calculation.profit) }}
          >
            {calculation.profitPercentage >= 0 ? "+" : ""}
            {calculation.profitPercentage.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span style={{ color: "var(--muted)" }}>Risk Level</span>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: getRiskColor(calculation.riskLevel) + "22",
              color: getRiskColor(calculation.riskLevel),
              border: `1px solid ${getRiskColor(calculation.riskLevel)}44`,
            }}
          >
            {calculation.riskLevel.toUpperCase()}
          </span>
        </div>

        {/* Risk Warning */}
        {calculation.riskLevel === "high" && (
          <div
            className="p-3 rounded-lg text-xs"
            style={{
              background: "#ef444418",
              color: "#ef4444",
              border: "1px solid #ef444444",
            }}
          >
            ⚠️ High-risk trade. Consider reducing position size or adjusting exit price.
          </div>
        )}

        {/* Fee Breakdown */}
        <div className="text-xs pt-2" style={{ color: "var(--muted)" }}>
          Trading fee (2%): ${calculation.feeAmount.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
