"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import { useAccount } from "@particle-network/connectkit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  market: string;
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  avgCost: number;       // cost per share in USDC
  currentPrice: number;  // current price per share (0–1)
  status: "open" | "closed" | "resolved";
  outcome?: "YES" | "NO";
}

export interface PortfolioSnapshot {
  timestamp: number; // unix ms
  value: number;     // total portfolio value in USDC
}

export interface PortfolioWidgetProps {
  /** Live positions — pass from API/contract; falls back to mock data */
  positions?: Position[];
  /** Historical snapshots for the performance chart */
  history?: PortfolioSnapshot[];
  /** Called on each refresh tick (use to re-fetch data) */
  onRefresh?: () => void;
  /** Auto-refresh interval in ms. 0 = disabled. Default: 30 000 */
  refreshInterval?: number;
}

// ─── Time ranges ─────────────────────────────────────────────────────────────

type Range = "1W" | "1M" | "3M" | "ALL";
const RANGES: Range[] = ["1W", "1M", "3M", "ALL"];

function cutoff(range: Range): number {
  const now = Date.now();
  switch (range) {
    case "1W":  return subDays(now, 7).getTime();
    case "1M":  return subMonths(now, 1).getTime();
    case "3M":  return subMonths(now, 3).getTime();
    case "ALL": return 0;
  }
}

function xTickFormat(range: Range, ts: number): string {
  switch (range) {
    case "1W":  return format(ts, "EEE");
    case "1M":  return format(ts, "MMM d");
    case "3M":  return format(ts, "MMM d");
    case "ALL": return format(ts, "MMM yy");
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_POSITIONS: Position[] = [
  {
    id: "p1",
    market: "Will AA123 arrive on time?",
    marketId: "1",
    side: "YES",
    shares: 120,
    avgCost: 0.55,
    currentPrice: 0.62,
    status: "open",
  },
  {
    id: "p2",
    market: "Will UA456 be delayed > 30 min?",
    marketId: "2",
    side: "NO",
    shares: 80,
    avgCost: 0.60,
    currentPrice: 0.59,
    status: "open",
  },
  {
    id: "p3",
    market: "Will DL789 be cancelled?",
    marketId: "3",
    side: "NO",
    shares: 200,
    avgCost: 0.88,
    currentPrice: 0.92,
    status: "closed",
  },
  {
    id: "p4",
    market: "Will SW101 depart on time?",
    marketId: "4",
    side: "YES",
    shares: 50,
    avgCost: 0.70,
    currentPrice: 0.75,
    status: "open",
  },
  {
    id: "p5",
    market: "Will BA202 arrive early?",
    marketId: "5",
    side: "YES",
    shares: 150,
    avgCost: 0.50,
    currentPrice: 1.0,
    status: "resolved",
    outcome: "YES",
  },
];

function generateMockHistory(): PortfolioSnapshot[] {
  const points: PortfolioSnapshot[] = [];
  const now = Date.now();
  let value = 800;
  // ~90 days of daily snapshots
  for (let i = 90; i >= 0; i--) {
    value = Math.max(200, value + (Math.random() - 0.45) * 40);
    points.push({
      timestamp: subDays(now, i).getTime(),
      value: parseFloat(value.toFixed(2)),
    });
  }
  return points;
}

const MOCK_HISTORY = generateMockHistory();

// ─── Asset-type breakdown colours ────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function positionValue(p: Position): number {
  if (p.status === "resolved") {
    return p.outcome === p.side ? p.shares * 1 : 0;
  }
  return p.shares * p.currentPrice;
}

function positionCost(p: Position): number {
  return p.shares * p.avgCost;
}

function positionPnl(p: Position): number {
  return positionValue(p) - positionCost(p);
}

function positionPnlPct(p: Position): number {
  const cost = positionCost(p);
  if (cost === 0) return 0;
  return (positionPnl(p) / cost) * 100;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatPct(n: number, showSign = true): string {
  const sign = showSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
      {sub !== undefined && (
        <p
          className="text-xs font-medium"
          style={{
            color:
              positive === undefined
                ? "var(--muted)"
                : positive
                ? "#22c55e"
                : "#ef4444",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const value = positionValue(position);
  const pnl = positionPnl(position);
  const pnlPct = positionPnlPct(position);
  const isPositive = pnl >= 0;

  const statusColors: Record<Position["status"], { bg: string; color: string }> = {
    open:     { bg: "#22c55e22", color: "#22c55e" },
    closed:   { bg: "#f59e0b22", color: "#f59e0b" },
    resolved: { bg: "#3b82f622", color: "#3b82f6" },
  };
  const sc = statusColors[position.status];

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      {/* Market */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium line-clamp-1" style={{ color: "var(--foreground)" }}>
          {position.market}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: position.side === "YES" ? "#22c55e22" : "#ef444422",
              color: position.side === "YES" ? "#22c55e" : "#ef4444",
            }}
          >
            {position.side}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded capitalize"
            style={{ background: sc.bg, color: sc.color }}
          >
            {position.status}
          </span>
        </div>
      </td>

      {/* Shares */}
      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--foreground)" }}>
        {position.shares.toLocaleString()}
      </td>

      {/* Avg cost */}
      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--muted)" }}>
        {(position.avgCost * 100).toFixed(0)}¢
      </td>

      {/* Current price */}
      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--foreground)" }}>
        {position.status === "resolved"
          ? position.outcome === position.side
            ? "100¢ ✓"
            : "0¢ ✗"
          : `${(position.currentPrice * 100).toFixed(0)}¢`}
      </td>

      {/* Value */}
      <td className="px-4 py-3 text-right text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {formatUsd(value)}
      </td>

      {/* P&L */}
      <td className="px-4 py-3 text-right">
        <p
          className="text-sm font-semibold"
          style={{ color: isPositive ? "#22c55e" : "#ef4444" }}
        >
          {isPositive ? "+" : ""}{formatUsd(pnl)}
        </p>
        <p className="text-xs" style={{ color: isPositive ? "#22c55e" : "#ef4444" }}>
          {formatPct(pnlPct)}
        </p>
      </td>
    </tr>
  );
}

function PortfolioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
    >
      <p className="mb-1" style={{ color: "var(--muted)" }}>
        {label ? format(label, "MMM d, yyyy") : ""}
      </p>
      <p className="font-semibold">{formatUsd(payload[0].value)}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
    >
      <p className="font-medium">{name}</p>
      <p style={{ color: "var(--muted)" }}>
        {formatUsd(value)} · {(percent * 100).toFixed(1)}%
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioWidget({
  positions = MOCK_POSITIONS,
  history = MOCK_HISTORY,
  onRefresh,
  refreshInterval = 30_000,
}: PortfolioWidgetProps) {
  const { isConnected } = useAccount();
  const [range, setRange] = useState<Range>("1M");
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + positionValue(p), 0),
    [positions]
  );

  const totalCost = useMemo(
    () => positions.reduce((sum, p) => sum + positionCost(p), 0),
    [positions]
  );

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const isOverallPositive = totalPnl >= 0;

  const openPositions = positions.filter((p) => p.status === "open");
  const resolvedPositions = positions.filter((p) => p.status === "resolved");

  // ── Filtered history for chart ─────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    const from = cutoff(range);
    return history.filter((h) => h.timestamp >= from);
  }, [history, range]);

  // Period gain/loss vs first point in range
  const periodChange = useMemo(() => {
    if (filteredHistory.length < 2) return { abs: 0, pct: 0 };
    const first = filteredHistory[0].value;
    const last = filteredHistory[filteredHistory.length - 1].value;
    return {
      abs: last - first,
      pct: first > 0 ? ((last - first) / first) * 100 : 0,
    };
  }, [filteredHistory]);

  // ── Asset breakdown for pie chart ──────────────────────────────────────────

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      const key = p.market.length > 28 ? p.market.slice(0, 28) + "…" : p.market;
      map.set(key, (map.get(key) ?? 0) + positionValue(p));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  // ── Auto-refresh ───────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    onRefresh?.();
    // Simulate async refresh delay
    await new Promise((r) => setTimeout(r, 600));
    setLastUpdated(Date.now());
    setIsRefreshing(false);
  }, [onRefresh]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(handleRefresh, refreshInterval);
    return () => clearInterval(id);
  }, [handleRefresh, refreshInterval]);

  const xFormatter = (ts: number) => xTickFormat(range, ts);

  // ── Chart gradient id (unique per mount to avoid SVG conflicts) ────────────
  const gradientId = "portfolioGradient";

  // ── Not connected state ────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div
        className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <span className="text-3xl" aria-hidden>💼</span>
        <p className="font-semibold" style={{ color: "var(--foreground)" }}>
          Connect your wallet
        </p>
        <p className="text-sm max-w-xs" style={{ color: "var(--muted)" }}>
          Connect a wallet to view your portfolio balance, positions, and performance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Portfolio
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Last updated {format(lastUpdated, "HH:mm:ss")}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
          aria-label="Refresh portfolio"
        >
          <RefreshIcon spinning={isRefreshing} />
          Refresh
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Value"
          value={formatUsd(totalValue)}
          sub={`${openPositions.length} open position${openPositions.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total P&L"
          value={formatUsd(totalPnl)}
          sub={formatPct(totalPnlPct)}
          positive={isOverallPositive}
        />
        <StatCard
          label={`${range} Change`}
          value={formatUsd(periodChange.abs)}
          sub={formatPct(periodChange.pct)}
          positive={periodChange.abs >= 0}
        />
        <StatCard
          label="Resolved"
          value={String(resolvedPositions.length)}
          sub={`${positions.length} total`}
        />
      </div>

      {/* ── Performance chart ── */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Portfolio Performance
            </p>
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: periodChange.abs >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {periodChange.abs >= 0 ? "▲" : "▼"} {formatUsd(Math.abs(periodChange.abs))} (
              {formatPct(Math.abs(periodChange.pct), false)}) this period
            </p>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="text-xs px-2.5 py-1 rounded-md transition-colors"
                style={{
                  background: range === r ? "#3b82f622" : "transparent",
                  color: range === r ? "#3b82f6" : "var(--muted)",
                  border: `1px solid ${range === r ? "#3b82f655" : "var(--border)"}`,
                }}
                aria-pressed={range === r}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart
            data={filteredHistory}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={xFormatter}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<PortfolioTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Asset breakdown ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Asset Breakdown
          </p>
          {breakdown.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>
              No positions yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  aria-label="Asset breakdown pie chart"
                >
                  {breakdown.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => (
                    <span style={{ color: "var(--muted)" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Allocation list */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Allocation
          </p>
          {breakdown.map((item, i) => {
            const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className="truncate max-w-[60%]"
                    style={{ color: "var(--foreground)" }}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {formatUsd(item.value)} · {pct.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--border)" }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.name}: ${pct.toFixed(1)}%`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Positions table ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Positions
          </p>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {positions.length} total
          </span>
        </div>

        {positions.length === 0 ? (
          <div
            className="px-4 py-10 text-center text-sm"
            style={{ color: "var(--muted)", background: "var(--background)" }}
          >
            No positions found. Start trading to see your portfolio here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ background: "var(--background)" }}>
              <thead>
                <tr style={{ background: "var(--card)" }}>
                  {["Market", "Shares", "Avg Cost", "Price", "Value", "P&L"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${
                        h === "Market" ? "text-left" : "text-right"
                      }`}
                      style={{ color: "var(--muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <PositionRow key={p.id} position={p} />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--card)" }}>
                  <td
                    colSpan={4}
                    className="px-4 py-2.5 text-xs font-semibold"
                    style={{ color: "var(--muted)" }}
                  >
                    TOTAL
                  </td>
                  <td
                    className="px-4 py-2.5 text-right text-sm font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {formatUsd(totalValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <p
                      className="text-sm font-bold"
                      style={{ color: isOverallPositive ? "#22c55e" : "#ef4444" }}
                    >
                      {isOverallPositive ? "+" : ""}{formatUsd(totalPnl)}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: isOverallPositive ? "#22c55e" : "#ef4444" }}
                    >
                      {formatPct(totalPnlPct)}
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Refresh icon ─────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{
        animation: spinning ? "spin 0.8s linear infinite" : "none",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path
        d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 2v3h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
