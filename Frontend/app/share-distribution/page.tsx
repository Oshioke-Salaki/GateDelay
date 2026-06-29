"use client";
import { useState } from "react";
import ShareDistribution from "../../components/chart/ShareDistribution";

const SAMPLE_DATA = [
  { outcome: "YES", shares: 1250, value: 975.50, color: "#22c55e" },
  { outcome: "NO", shares: 850, value: 612.75, color: "#ef4444" },
];

const SAMPLE_DATA_3 = [
  { outcome: "On Time", shares: 2100, value: 1680.00, color: "#22c55e" },
  { outcome: "Delayed", shares: 1200, value: 840.00, color: "#f59e0b" },
  { outcome: "Cancelled", shares: 450, value: 225.00, color: "#ef4444" },
];

export default function ShareDistributionPage() {
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Market Share Distribution
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Visualize how market shares are distributed among outcomes
        </p>
      </div>

      {/* Chart Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setChartType("pie")}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: chartType === "pie" ? "var(--foreground)" : "var(--background)",
            color: chartType === "pie" ? "var(--background)" : "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          Pie Chart
        </button>
        <button
          onClick={() => setChartType("bar")}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: chartType === "bar" ? "var(--foreground)" : "var(--background)",
            color: chartType === "bar" ? "var(--background)" : "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          Bar Chart
        </button>
      </div>

      {/* Binary Market */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Binary Market Example
        </h2>
        <ShareDistribution
          data={SAMPLE_DATA}
          chartType={chartType}
          title="Will Flight AA123 Arrive On Time?"
        />
      </div>

      {/* Multi-outcome Market */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Multi-Outcome Market Example
        </h2>
        <ShareDistribution
          data={SAMPLE_DATA_3}
          chartType={chartType}
          title="Flight Status Distribution"
        />
      </div>
    </main>
  );
}
