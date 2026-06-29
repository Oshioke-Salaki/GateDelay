"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, subMonths, subWeeks } from "date-fns";

export interface LiquidityDepthPoint {
  notionalUsd: number;
  buySlippageBps: number;
  sellSlippageBps: number;
}

export interface LiquidityHistoryPoint {
  timestamp: number;
  poolBalanceUsd: number;
  netFlowUsd: number;
  lpApr: number;
  activeProviders: number;
}

interface LiquidityChartProps {
  depthData?: LiquidityDepthPoint[];
  historyData?: LiquidityHistoryPoint[];
  marketTitle?: string;
}

type Range = "1W" | "1M" | "3M";

const RANGES: Range[] = ["1W", "1M", "3M"];

const MOCK_DEPTH_DATA: LiquidityDepthPoint[] = [
  { notionalUsd: 100, buySlippageBps: 6, sellSlippageBps: 5 },
  { notionalUsd: 250, buySlippageBps: 10, sellSlippageBps: 9 },
  { notionalUsd: 500, buySlippageBps: 16, sellSlippageBps: 14 },
  { notionalUsd: 1000, buySlippageBps: 27, sellSlippageBps: 24 },
  { notionalUsd: 2500, buySlippageBps: 49, sellSlippageBps: 45 },
  { notionalUsd: 5000, buySlippageBps: 82, sellSlippageBps: 76 },
  { notionalUsd: 7500, buySlippageBps: 121, sellSlippageBps: 114 },
  { notionalUsd: 10000, buySlippageBps: 164, sellSlippageBps: 157 },
];

const MOCK_HISTORY_DATA: LiquidityHistoryPoint[] = [
  { timestamp: Date.UTC(2026, 0, 28), poolBalanceUsd: 348000, netFlowUsd: 5200, lpApr: 13.8, activeProviders: 88 },
  { timestamp: Date.UTC(2026, 1, 4), poolBalanceUsd: 352500, netFlowUsd: 4500, lpApr: 14.1, activeProviders: 90 },
  { timestamp: Date.UTC(2026, 1, 11), poolBalanceUsd: 357200, netFlowUsd: 4700, lpApr: 14.4, activeProviders: 91 },
  { timestamp: Date.UTC(2026, 1, 18), poolBalanceUsd: 363800, netFlowUsd: 6600, lpApr: 14.9, activeProviders: 95 },
  { timestamp: Date.UTC(2026, 1, 25), poolBalanceUsd: 359400, netFlowUsd: -4400, lpApr: 13.6, activeProviders: 92 },
  { timestamp: Date.UTC(2026, 2, 4), poolBalanceUsd: 366700, netFlowUsd: 7300, lpApr: 15.2, activeProviders: 97 },
  { timestamp: Date.UTC(2026, 2, 11), poolBalanceUsd: 371900, netFlowUsd: 5200, lpApr: 15.6, activeProviders: 99 },
  { timestamp: Date.UTC(2026, 2, 18), poolBalanceUsd: 376400, netFlowUsd: 4500, lpApr: 15.7, activeProviders: 101 },
  { timestamp: Date.UTC(2026, 2, 25), poolBalanceUsd: 381200, netFlowUsd: 4800, lpApr: 15.9, activeProviders: 103 },
  { timestamp: Date.UTC(2026, 3, 1), poolBalanceUsd: 387300, netFlowUsd: 6100, lpApr: 16.2, activeProviders: 106 },
  { timestamp: Date.UTC(2026, 3, 8), poolBalanceUsd: 392800, netFlowUsd: 5500, lpApr: 16.4, activeProviders: 108 },
  { timestamp: Date.UTC(2026, 3, 15), poolBalanceUsd: 398100, netFlowUsd: 5300, lpApr: 16.1, activeProviders: 110 },
  { timestamp: Date.UTC(2026, 3, 22), poolBalanceUsd: 402500, netFlowUsd: 4400, lpApr: 15.8, activeProviders: 111 },
];

function cutoff(range: Range, nowTs: number): number {
  switch (range) {
    case "1W":
      return subWeeks(nowTs, 1).getTime();
    case "1M":
      return subDays(nowTs, 30).getTime();
    case "3M":
      return subMonths(nowTs, 3).getTime();
  }
}

function formatLargeUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatLargeCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function DepthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name: string }>; label?: number }) {
  if (!active || !payload || payload.length === 0 || typeof label !== "number") return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
    >
      <p className="mb-1" style={{ color: "var(--muted)" }}>
        Trade size: {formatLargeUsd(label)}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(0)} bps ({(entry.value / 100).toFixed(2)}%)
        </p>
      ))}
    </div>
  );
}

function HistoryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name: string }>; label?: number }) {
  if (!active || !payload || payload.length === 0 || typeof label !== "number") return null;

  const pool = payload.find((entry) => entry.dataKey === "poolBalanceUsd")?.value;
  const netFlow = payload.find((entry) => entry.dataKey === "netFlowUsd")?.value;
  const apr = payload.find((entry) => entry.dataKey === "lpApr")?.value;
  const providers = payload.find((entry) => entry.dataKey === "activeProviders")?.value;

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
    >
      <p className="mb-1" style={{ color: "var(--muted)" }}>
        {format(label, "MMM d, yyyy")}
      </p>
      {typeof pool === "number" && <p>Pool balance: {formatLargeUsd(pool)}</p>}
      {typeof netFlow === "number" && <p>Net LP flow: {netFlow >= 0 ? "+" : ""}{formatLargeUsd(netFlow)}</p>}
      {typeof apr === "number" && <p>Incentive APR: {apr.toFixed(1)}%</p>}
      {typeof providers === "number" && <p>Active LPs: {Math.round(providers)}</p>}
    </div>
  );
}

export default function LiquidityChart({
  depthData = MOCK_DEPTH_DATA,
  historyData = MOCK_HISTORY_DATA,
  marketTitle = "Market Liquidity",
}: LiquidityChartProps) {
  const [range, setRange] = useState<Range>("1M");

  const nowTs = historyData[historyData.length - 1]?.timestamp ?? Date.now();

  const filteredHistory = useMemo(() => {
    const minTs = cutoff(range, nowTs);
    const slice = historyData.filter((point) => point.timestamp >= minTs);
    return slice.length > 0 ? slice : historyData;
  }, [historyData, nowTs, range]);

  const latest = filteredHistory[filteredHistory.length - 1] ?? historyData[historyData.length - 1];
  const first = filteredHistory[0] ?? historyData[0];
  const poolChangePct = latest && first ? ((latest.poolBalanceUsd - first.poolBalanceUsd) / first.poolBalanceUsd) * 100 : 0;

  const depthAtOnePercent = depthData.find((point) => point.buySlippageBps >= 100)?.notionalUsd ?? depthData[depthData.length - 1]?.notionalUsd ?? 0;
  const baseApr = latest?.lpApr ?? 0;
  const volumeBoost = latest ? Math.min(4.0, Math.max(1.2, latest.netFlowUsd / 2000)) : 1.2;
  const rebatePct = Math.min(35, Math.max(10, Math.round(baseApr * 1.6)));

  return (
    <section
      className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {marketTitle}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Liquidity curve, current depth, and LP incentive health
          </p>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: range === item ? "#0f766e22" : "transparent",
                color: range === item ? "#0f766e" : "var(--muted)",
                border: `1px solid ${range === item ? "#0f766e55" : "var(--border)"}`,
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Current Pool Balance</p>
          <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {latest ? formatLargeUsd(latest.poolBalanceUsd) : "$0"}
          </p>
          <p className="text-xs" style={{ color: poolChangePct >= 0 ? "#16a34a" : "#dc2626" }}>
            {poolChangePct >= 0 ? "+" : ""}{poolChangePct.toFixed(2)}% in selected range
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Depth at 1% Slippage</p>
          <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {formatLargeUsd(depthAtOnePercent)}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Higher value means stronger market depth
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Active LP Providers</p>
          <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {latest ? latest.activeProviders : 0}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Incentivized by APR and fee rebates
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>Current Market Depth Curve</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={depthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="notionalUsd"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${formatLargeCompact(value)}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(value) => `${value} bps`}
              />
              <Tooltip content={<DepthTooltip />} />
              <Line type="monotone" dataKey="buySlippageBps" name="Buy impact" stroke="#0ea5e9" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="sellSlippageBps" name="Sell impact" stroke="#f59e0b" strokeWidth={2.2} dot={false} />
              <ReferenceLine y={100} stroke="#64748b" strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Hover points to compare price impact by trade size.
          </p>
        </div>

        <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>Historical Pool Liquidity</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filteredHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="poolGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
                tickFormatter={(value) => format(value, "MMM d")}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(value) => `$${formatLargeCompact(value)}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<HistoryTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="poolBalanceUsd"
                name="Pool balance"
                stroke="#14b8a6"
                fill="url(#poolGradient)"
                strokeWidth={2.1}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="lpApr"
                name="LP APR"
                stroke="#a855f7"
                strokeWidth={1.8}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Historical APR overlays liquidity to show when incentive programs increased depth.
          </p>
        </div>
      </div>

      <div className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Liquidity Provision Incentives</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-md p-2" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Base LP APR: <span className="font-semibold">{baseApr.toFixed(1)}%</span>
          </div>
          <div className="rounded-md p-2" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Volume Boost Multiplier: <span className="font-semibold">{volumeBoost.toFixed(1)}x</span>
          </div>
          <div className="rounded-md p-2" style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Maker Fee Rebate: <span className="font-semibold">{rebatePct}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
