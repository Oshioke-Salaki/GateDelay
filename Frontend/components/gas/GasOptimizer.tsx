"use client";

import { useState, useEffect, useMemo } from "react";

export type GasSpeed = "slow" | "standard" | "fast";

interface GasPriceOption {
  speed: GasSpeed;
  label: string;
  gwei: number;
  estimatedTime: string;
  estimatedFeeUsd: number;
  savings: number;
  recommended: boolean;
}

interface GasOptimizerProps {
  gasLimit?: number;
  ethPrice?: number;
  onSelect?: (speed: GasSpeed, gwei: number) => void;
  className?: string;
}

export default function GasOptimizer({
  gasLimit = 150000,
  ethPrice = 2500,
  onSelect,
  className = "",
}: GasOptimizerProps) {
  const [selectedSpeed, setSelectedSpeed] = useState<GasSpeed>("standard");
  const [baseFeeGwei, setBaseFeeGwei] = useState<number>(0.5);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate fetching current gas prices
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setBaseFeeGwei(Math.random() * 0.8 + 0.3);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const options: GasPriceOption[] = useMemo(() => {
    const speedMultipliers = {
      slow: 0.85,
      standard: 1.0,
      fast: 1.25,
    };

    const speedTimes = {
      slow: "~30-60s",
      standard: "~12-20s",
      fast: "~6-12s",
    };

    const options: GasPriceOption[] = (["slow", "standard", "fast"] as const).map((speed) => {
      const gwei = baseFeeGwei * speedMultipliers[speed];
      const gasInEth = (gasLimit * gwei) / 1e9;
      const feeUsd = gasInEth * ethPrice;
      const standardFeeUsd = (gasLimit * baseFeeGwei * speedMultipliers.standard) / 1e9 * ethPrice;
      const savings = speed === "slow" ? standardFeeUsd - feeUsd : 0;

      return {
        speed,
        label: speed.charAt(0).toUpperCase() + speed.slice(1),
        gwei,
        estimatedTime: speedTimes[speed],
        estimatedFeeUsd: feeUsd,
        savings,
        recommended: speed === "standard",
      };
    });

    return options;
  }, [baseFeeGwei, gasLimit, ethPrice]);

  const handleSelect = (speed: GasSpeed) => {
    setSelectedSpeed(speed);
    const option = options.find((o) => o.speed === speed);
    if (option && onSelect) {
      onSelect(speed, option.gwei);
    }
  };

  const getSpeedColor = (speed: GasSpeed) => {
    switch (speed) {
      case "slow":
        return "#f59e0b";
      case "standard":
        return "#3b82f6";
      case "fast":
        return "#22c55e";
    }
  };

  const selectedOption = options.find((o) => o.speed === selectedSpeed);

  return (
    <div
      className={`rounded-xl p-6 space-y-6 ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
          Gas Price Optimizer
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Choose your preferred transaction speed and cost
        </p>
      </div>

      {/* Gas Options Grid */}
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <button
            key={option.speed}
            onClick={() => handleSelect(option.speed)}
            disabled={isLoading}
            className={`relative rounded-lg p-4 transition-all text-left ${
              selectedSpeed === option.speed ? "ring-2" : ""
            }`}
            style={{
              background: selectedSpeed === option.speed ? getSpeedColor(option.speed) + "18" : "var(--border)",
              border: `1px solid ${
                selectedSpeed === option.speed ? getSpeedColor(option.speed) : "var(--border)"
              }`,
              ["--tw-ring-color" as any]: getSpeedColor(option.speed),
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {/* Recommended Badge */}
            {option.recommended && selectedSpeed !== option.speed && (
              <div
                className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: "#3b82f6",
                  color: "white",
                }}
              >
                Recommended
              </div>
            )}

            {/* Speed Label */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: getSpeedColor(option.speed) }}
                aria-hidden="true"
              />
              <span
                className="font-semibold text-sm"
                style={{ color: getSpeedColor(option.speed) }}
              >
                {option.label}
              </span>
            </div>

            {/* Gas Price */}
            <div className="mb-2">
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Gas Price
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {option.gwei.toFixed(3)} Gwei
              </p>
            </div>

            {/* Estimated Time */}
            <div className="mb-2">
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Est. Time
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {option.estimatedTime}
              </p>
            </div>

            {/* Fee */}
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Est. Fee
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                ${option.estimatedFeeUsd.toFixed(2)}
              </p>
            </div>

            {/* Savings Badge */}
            {option.savings > 0 && (
              <div
                className="mt-2 px-2 py-1 rounded text-xs font-semibold"
                style={{
                  background: "#22c55e22",
                  color: "#22c55e",
                }}
              >
                Save ${option.savings.toFixed(2)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Option Details */}
      {selectedOption && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            background: getSpeedColor(selectedOption.speed) + "18",
            border: `1px solid ${getSpeedColor(selectedOption.speed)}44`,
          }}
        >
          <div className="flex justify-between items-center">
            <span style={{ color: "var(--muted)" }}>Selected Speed</span>
            <span
              className="font-semibold"
              style={{ color: getSpeedColor(selectedOption.speed) }}
            >
              {selectedOption.label}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span style={{ color: "var(--muted)" }}>Gas Price</span>
            <span style={{ color: "var(--foreground)" }} className="font-semibold">
              {selectedOption.gwei.toFixed(3)} Gwei
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span style={{ color: "var(--muted)" }}>Estimated Fee</span>
            <span style={{ color: "var(--foreground)" }} className="font-semibold">
              ${selectedOption.estimatedFeeUsd.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span style={{ color: "var(--muted)" }}>Confirmation Time</span>
            <span style={{ color: "var(--foreground)" }} className="font-semibold">
              {selectedOption.estimatedTime}
            </span>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div
        className="rounded-lg p-3 text-xs space-y-2"
        style={{
          background: "var(--border)",
          color: "var(--muted)",
        }}
      >
        <p>
          💡 <strong>Tip:</strong> Choose "Slow" to save on fees during low-traffic periods, or "Fast" for time-sensitive trades.
        </p>
        <p>
          ⚡ <strong>Note:</strong> Actual confirmation times may vary based on network conditions.
        </p>
      </div>

      {/* Refresh Status */}
      {isLoading && (
        <div className="text-center text-xs" style={{ color: "var(--muted)" }}>
          Fetching current gas prices...
        </div>
      )}
    </div>
  );
}
