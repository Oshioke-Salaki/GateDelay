"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";

interface TradeData {
  date: string;
  trades: number;
  volume: number;
  profit: number;
}

interface PortfolioMetrics {
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  averageTradeSize: number;
  bestTrade: number;
  worstTrade: number;
}

interface PortfolioPosition {
  market: string;
  shares: number;
  value: number;
  unrealizedPnL: number;
}

type TimeRange = "7d" | "30d" | "90d" | "all";

function ChartState({
  loading,
  error,
  empty,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
}) {
  const message = loading
    ? "Loading chart data…"
    : error
    ? `Could not load chart data: ${error}`
    : empty
    ? "No data available for this date range."
    : "No chart data available.";

  return (
    <div
      className="flex h-[300px] flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400"
      role={error ? "alert" : "status"}
    >
      {loading && (
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      )}
      <p>{message}</p>
    </div>
  );
}

function formatChartDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d");
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2" role="list" aria-label="Chart legend">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300" role="listitem">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function AnalyticsDashboardContent() {
  const [tradeHistory, setTradeHistory] = useState<TradeData[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);

    fetch(`/api/analytics/trade-history?range=${timeRange}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<TradeData[]>;
      })
      .then((data) => {
        if (active) setTradeHistory(Array.isArray(data) ? data : []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTradeHistory([]);
        setHistoryError(error instanceof Error ? error.message : "Unknown error");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [timeRange]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return response.json() as Promise<T>;
    };

    Promise.allSettled([
      fetchJson<PortfolioMetrics>("/api/analytics/metrics"),
      fetchJson<PortfolioPosition[]>("/api/analytics/positions"),
    ]).then(([metricsResult, positionsResult]) => {
      if (!active) return;
      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value);
      } else {
        setMetricsError(metricsResult.reason instanceof Error ? metricsResult.reason.message : "Unknown error");
      }
      if (positionsResult.status === "fulfilled") {
        setPositions(Array.isArray(positionsResult.value) ? positionsResult.value : []);
      } else {
        setPositionsError(positionsResult.reason instanceof Error ? positionsResult.reason.message : "Unknown error");
      }
      setMetricsLoading(false);
      setPositionsLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const winLossData = metrics
    ? [
        { name: "Wins", value: Math.round(metrics.totalTrades * (metrics.winRate / 100)) },
        { name: "Losses", value: Math.round(metrics.totalTrades * (1 - metrics.winRate / 100)) },
      ]
    : [];

  const COLORS = ["#10b981", "#ef4444"];
  const rangeLabel = timeRange === "all"
    ? "All available history"
    : `${format(subDays(new Date(), Number(timeRange.slice(0, -1)) - 1), "MMM d, yyyy")} – ${format(new Date(), "MMM d, yyyy")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Trade Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed insights into your trading performance
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Filter analytics by date range">
          {(["7d", "30d", "90d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
              }`}
            >
              {range === "all" ? "All Time" : range.toUpperCase()}
            </button>
          ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
            {rangeLabel}
            {historyLoading && <span className="ml-2 text-blue-600 dark:text-blue-400">Updating…</span>}
          </p>
        </div>

        {/* Key Metrics */}
        {metricsLoading ? (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400" role="status">
            Loading portfolio metrics…
          </div>
        ) : metricsError ? (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
            Could not load portfolio metrics: {metricsError}
          </div>
        ) : metrics && metrics.totalTrades > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Trades</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metrics.totalTrades}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Win Rate</p>
              <p className="text-3xl font-bold text-green-600">{metrics.winRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Profit</p>
              <p className="text-3xl font-bold text-green-600">
                ${metrics.totalProfit.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Avg Trade Size</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                ${metrics.averageTradeSize.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400" role="status">
            No portfolio metrics are available yet.
          </div>
        )}

        {/* Charts */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Trade Volume Over Time</h2>
            <ChartLegend items={[{ label: "Trade volume (USD)", color: "#3b82f6" }]} />
            {historyLoading ? <ChartState loading /> : historyError ? <ChartState error={historyError} /> : tradeHistory.length === 0 ? <ChartState empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={tradeHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatChartDate(String(value))} />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Trade volume"]} />
                  <Line type="monotone" dataKey="volume" name="Trade volume (USD)" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Win/Loss Distribution</h2>
            <ChartLegend items={[{ label: "Wins", color: COLORS[0] }, { label: "Losses", color: COLORS[1] }]} />
            {metricsLoading ? <ChartState loading /> : metricsError ? <ChartState error={metricsError} /> : winLossData.length === 0 || metrics?.totalTrades === 0 ? <ChartState empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Profit/Loss Trend</h2>
            <ChartLegend items={[{ label: "Profit / loss (USD)", color: "#10b981" }]} />
            {historyLoading ? <ChartState loading /> : historyError ? <ChartState error={historyError} /> : tradeHistory.length === 0 ? <ChartState empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tradeHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatChartDate(String(value))} />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, "Profit / loss"]} />
                  <Bar dataKey="profit" name="Profit / loss (USD)" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Trades Per Day</h2>
            <ChartLegend items={[{ label: "Trade count", color: "#8b5cf6" }]} />
            {historyLoading ? <ChartState loading /> : historyError ? <ChartState error={historyError} /> : tradeHistory.length === 0 ? <ChartState empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tradeHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatChartDate(String(value))} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Trades"]} />
                  <Bar dataKey="trades" name="Trade count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Open Positions */}
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Open Positions</h2>
          {positionsLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400" role="status">Loading open positions…</p>
          ) : positionsError ? (
            <p className="text-sm text-red-700 dark:text-red-300" role="alert">Could not load positions: {positionsError}</p>
          ) : positions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400" role="status">No open positions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Market
                    </th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Shares
                    </th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Value
                    </th>
                    <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                      Unrealized P&L
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{position.market}</td>
                      <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                        {position.shares}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                        ${position.value.toFixed(2)}
                      </td>
                      <td
                        className={`text-right py-3 px-4 font-semibold ${
                          position.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ${position.unrealizedPnL.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PageErrorBoundary>
      <AnalyticsDashboardContent />
    </PageErrorBoundary>
  );
}
