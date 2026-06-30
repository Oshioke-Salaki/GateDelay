"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface GasTrackerProps {
  className?: string;
}

interface GasDataPoint {
  time: string;
  price: number;
}

interface GasPrediction {
  timeframe: string;
  predictedPrice: number;
  confidence: number;
}

const INITIAL_GAS_PRICE = 2.5;
const INITIAL_HISTORY: GasDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  price: INITIAL_GAS_PRICE + Math.sin(i / 4) * 0.8 + Math.random() * 0.3,
}));

const GAS_OPTIMIZATION_TIPS = [
  "Batch multiple transactions to reduce per-transaction overhead",
  "Use standard gas speed for non-urgent transactions",
  "Monitor gas prices during off-peak hours (UTC 00:00-08:00)",
  "Enable auto-gas estimation for optimal pricing",
];

export default function GasTracker({ className = "" }: GasTrackerProps) {
  const [currentPrice, setCurrentPrice] = useState(INITIAL_GAS_PRICE);
  const [history, setHistory] = useState<GasDataPoint[]>(INITIAL_HISTORY);
  const [predictions, setPredictions] = useState<GasPrediction[]>([
    { timeframe: "1h", predictedPrice: INITIAL_GAS_PRICE * 0.95, confidence: 0.85 },
    { timeframe: "4h", predictedPrice: INITIAL_GAS_PRICE * 1.05, confidence: 0.72 },
    { timeframe: "24h", predictedPrice: INITIAL_GAS_PRICE * 1.02, confidence: 0.58 },
  ]);
  const [selectedTip, setSelectedTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.5) * 0.4;
        return Math.max(0.5, prev + change);
      });

      setHistory((prev) => {
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
        const newPoint: GasDataPoint = {
          time: timeStr,
          price: currentPrice + (Math.random() - 0.5) * 0.3,
        };
        return [...prev.slice(-23), newPoint];
      });

      setPredictions((prev) =>
        prev.map((p) => ({
          ...p,
          predictedPrice: p.predictedPrice + (Math.random() - 0.5) * 0.1,
          confidence: Math.min(1, Math.max(0.3, p.confidence + (Math.random() - 0.5) * 0.05)),
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [currentPrice]);

  const avgPrice = history.reduce((sum, p) => sum + p.price, 0) / history.length;
  const maxPrice = Math.max(...history.map((p) => p.price));
  const minPrice = Math.min(...history.map((p) => p.price));
  const trend = currentPrice > avgPrice ? "up" : currentPrice < avgPrice ? "down" : "stable";

  return (
    <div
      className={`rounded-xl p-5 space-y-5 ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Gas Price Tracker
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Real-time gas prices and predictions
          </p>
        </div>

        {/* Current price display */}
        <div className="flex items-end gap-3">
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Current Price
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {currentPrice.toFixed(2)} Gwei
            </p>
          </div>
          <span
            className="text-sm font-semibold px-2 py-1 rounded-full"
            style={{
              background: trend === "up" ? "#ef444422" : trend === "down" ? "#22c55e22" : "#3b82f622",
              color: trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : "#3b82f6",
            }}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {Math.abs(currentPrice - avgPrice).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Average", value: avgPrice.toFixed(2) },
          { label: "High", value: maxPrice.toFixed(2) },
          { label: "Low", value: minPrice.toFixed(2) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {stat.label}
            </p>
            <p className="text-sm font-semibold mt-1" style={{ color: "var(--foreground)" }}>
              {stat.value} Gwei
            </p>
          </div>
        ))}
      </div>

      {/* Historical chart */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          24-Hour History
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                formatter={(value: any) => `${parseFloat(value).toFixed(2)} Gwei`}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Predictions */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          Price Predictions
        </p>
        <div className="space-y-2">
          {predictions.map((pred) => (
            <div key={pred.timeframe} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>{pred.timeframe}</span>
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--foreground)" }}>
                  {pred.predictedPrice.toFixed(2)} Gwei
                </span>
                <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pred.confidence * 100}%`,
                      background: "#3b82f6",
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {(pred.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gas optimization tips */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          Gas Optimization Tips
        </p>
        <div className="space-y-2">
          <p className="text-sm" style={{ color: "var(--foreground)" }}>
            {GAS_OPTIMIZATION_TIPS[selectedTip]}
          </p>
          <div className="flex gap-1">
            {GAS_OPTIMIZATION_TIPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedTip(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: selectedTip === i ? "24px" : "8px",
                  background: selectedTip === i ? "#3b82f6" : "var(--border)",
                }}
                aria-label={`Tip ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
