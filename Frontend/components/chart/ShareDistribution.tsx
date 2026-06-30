"use client";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export interface ShareData {
  outcome: string;
  shares: number;
  value: number;
  color: string;
}

interface ShareDistributionProps {
  data?: ShareData[];
  chartType?: "pie" | "bar";
  title?: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
    >
      <p className="font-semibold">{data.outcome}</p>
      <p style={{ color: "var(--muted)" }}>Shares: {data.shares.toLocaleString()}</p>
      <p style={{ color: "var(--muted)" }}>Value: ${data.value.toFixed(2)}</p>
      <p style={{ color: "var(--muted)" }}>
        {((data.shares / (payload[0].payload._total || 1)) * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export default function ShareDistribution({
  data = [
    { outcome: "YES", shares: 1250, value: 975.50, color: "#22c55e" },
    { outcome: "NO", shares: 850, value: 612.75, color: "#ef4444" },
  ],
  chartType = "pie",
  title = "Market Share Distribution",
}: ShareDistributionProps) {
  const stats = useMemo(() => {
    const totalShares = data.reduce((sum, d) => sum + d.shares, 0);
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);

    const withPercentage = data.map((d) => ({
      ...d,
      percentage: totalShares > 0 ? (d.shares / totalShares) * 100 : 0,
      _total: totalShares,
    }));

    return { totalShares, totalValue, data: withPercentage };
  }, [data]);

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {title}
        </p>
        <div className="flex gap-6 mt-2 flex-wrap">
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Total Shares
            </p>
            <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
              {stats.totalShares.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Total Value
            </p>
            <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
              ${stats.totalValue.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartType === "pie" ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={stats.data}
              dataKey="shares"
              nameKey="outcome"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ outcome, percentage }: any) => `${outcome} ${percentage.toFixed(1)}%`}
            >
              {stats.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="outcome"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="shares" radius={[8, 8, 0, 0]}>
              {stats.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Distribution Table */}
      <div className="space-y-2">
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Distribution Details
        </p>
        <div className="space-y-1">
          {stats.data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: item.color }}
                />
                <span style={{ color: "var(--foreground)" }}>{item.outcome}</span>
              </div>
              <div className="flex gap-4">
                <span style={{ color: "var(--muted)" }}>
                  {item.shares.toLocaleString()} shares
                </span>
                <span style={{ color: "var(--foreground)" }} className="font-semibold">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
