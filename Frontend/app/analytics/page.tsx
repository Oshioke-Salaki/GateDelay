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
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { useToast } from "@/hooks/useToast";

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

function AnalyticsDashboardContent() {
  const toast = useToast();
  const [tradeHistory, setTradeHistory] = useState<TradeData[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [historyRes, metricsRes, positionsRes] = await Promise.all([
          fetch(`/api/analytics/trade-history?range=${timeRange}`),
          fetch("/api/analytics/metrics"),
          fetch("/api/analytics/positions"),
        ]);

        if (historyRes.ok) {
          const data = await historyRes.json();
          setTradeHistory(data);
        }
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data);
        }
        if (positionsRes.ok) {
          const data = await positionsRes.json();
          setPositions(data);
        }
      } catch (error) {
        console.error("Failed to load analytics:", error);
        toast.error("Error", "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [timeRange, toast]);

  const winLossData = metrics
    ? [
        { name: "Wins", value: Math.round(metrics.totalTrades * (metrics.winRate / 100)) },
        { name: "Losses", value: Math.round(metrics.totalTrades * (1 - metrics.winRate / 100)) },
      ]
    : [];

  const COLORS = ["#10b981", "#ef4444"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

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
        <div className="mb-6 flex gap-2">
          {(["7d", "30d", "90d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              {range === "all" ? "All Time" : range.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        {metrics && (
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
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trade Volume Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Trade Volume Over Time
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tradeHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="volume" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Win/Loss Distribution */}
          {winLossData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Win/Loss Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Profit/Loss Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Profit/Loss Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tradeHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="profit" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trade Count Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Trades Per Day
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tradeHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="trades" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Open Positions */}
        {positions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Open Positions
            </h2>
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
          </div>
        )}
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
