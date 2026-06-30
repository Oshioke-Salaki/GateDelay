"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, subWeeks, subMonths } from "date-fns";

interface CashFlow {
  timestamp: number;
  amount: number; // positive = deposit, negative = withdrawal
}

interface PortfolioValue {
  timestamp: number;
  value: number;
}

type Period = "1W" | "1M" | "3M" | "1Y" | "ALL";
const PERIODS: Period[] = ["1W", "1M", "3M", "1Y", "ALL"];

function calculateTWR(values: PortfolioValue[], cashFlows: CashFlow[]): number {
  const sortedCashFlows = [...cashFlows].sort((a, b) => a.timestamp - b.timestamp);
  const sortedValues = [...values].sort((a, b) => a.timestamp - b.timestamp);

  if (sortedValues.length < 2) return 0;

  let twr = 1;
  let currentStartIdx = 0;

  for (const cf of sortedCashFlows) {
    const nextIdx = sortedValues.findIndex((v) => v.timestamp >= cf.timestamp);
    if (nextIdx === -1 || nextIdx <= currentStartIdx) continue;

    const startValue = sortedValues[currentStartIdx].value;
    const endValue = sortedValues[nextIdx].value;
    if (startValue === 0) continue;

    const subPeriodReturn = (endValue - cf.amount) / startValue;
    twr *= subPeriodReturn;
    currentStartIdx = nextIdx;
  }

  if (currentStartIdx < sortedValues.length - 1) {
    const startValue = sortedValues[currentStartIdx].value;
    const endValue = sortedValues[sortedValues.length - 1].value;
    if (startValue > 0) {
      const finalReturn = endValue / startValue;
      twr *= finalReturn;
    }
  }

  return (twr - 1) * 100;
}

function generateMockValues(): PortfolioValue[] {
  const now = Date.now();
  const points: PortfolioValue[] = [];
  let value = 1000;
  for (let i = 365; i >= 0; i--) {
    value = Math.max(500, value + (Math.random() - 0.48) * 30);
    points.push({
      timestamp: subDays(now, i).getTime(),
      value: parseFloat(value.toFixed(2)),
    });
  }
  return points;
}

const MOCK_VALUES = generateMockValues();
const MOCK_CASH_FLOWS: CashFlow[] = [
  { timestamp: subDays(Date.now(), 200).getTime(), amount: 500 },
  { timestamp: subDays(Date.now(), 100).getTime(), amount: -200 },
  { timestamp: subDays(Date.now(), 30).getTime(), amount: 300 },
];

const MOCK_MARKETS = [
  { id: "1", name: "AA123 On Time", twr1W: 5.2, twr1M: 12.5, twr3M: 28.3, twr1Y: 45.2 },
  { id: "2", name: "UA456 Delay", twr1W: -1.3, twr1M: 8.2, twr3M: 15.1, twr1Y: 22.4 },
  { id: "3", name: "DL789 Cancel", twr1W: 3.8, twr1M: 15.6, twr3M: 32.1, twr1Y: 58.9 },
];

function getPeriodStart(period: Period): number {
  const now = Date.now();
  switch (period) {
    case "1W": return subWeeks(now, 1).getTime();
    case "1M": return subMonths(now, 1).getTime();
    case "3M": return subMonths(now, 3).getTime();
    case "1Y": return subMonths(now, 12).getTime();
    case "ALL": return 0;
  }
}

function getXTickFormat(period: Period, ts: number): string {
  switch (period) {
    case "1W": return format(ts, "EEE");
    case "1M": return format(ts, "MMM d");
    case "3M": return format(ts, "MMM d");
    case "1Y": return format(ts, "MMM yy");
    case "ALL": return format(ts, "MMM yy");
  }
}

export default function TimeWeightedReturns() {
  const [period, setPeriod] = useState<Period>("3M");

  const filteredValues = useMemo(() => {
    const start = getPeriodStart(period);
    return MOCK_VALUES.filter((v) => v.timestamp >= start);
  }, [period]);

  const filteredCashFlows = useMemo(() => {
    const start = getPeriodStart(period);
    return MOCK_CASH_FLOWS.filter((cf) => cf.timestamp >= start);
  }, [period]);

  const twr = useMemo(() => {
    return calculateTWR(filteredValues, filteredCashFlows);
  }, [filteredValues, filteredCashFlows]);

  const chartData = useMemo(() => {
    return filteredValues.map((v, i) => {
      const firstValue = filteredValues[0]?.value ?? 1;
      const cumulativeReturn = ((v.value - firstValue) / firstValue) * 100;
      return {
        timestamp: v.timestamp,
        value: v.value,
        return: parseFloat(cumulativeReturn.toFixed(2)),
      };
    });
  }, [filteredValues]);

  const marketComparisonData = useMemo(() => {
    const getTWRForPeriod = (market: typeof MOCK_MARKETS[0]): number => {
      switch (period) {
        case "1W": return market.twr1W;
        case "1M": return market.twr1M;
        case "3M": return market.twr3M;
        case "1Y": return market.twr1Y;
        case "ALL": return market.twr1Y;
      }
    };
    return [
      ...MOCK_MARKETS.map((m) => ({ name: m.name, twr: getTWRForPeriod(m) })),
      { name: "Portfolio", twr: parseFloat(twr.toFixed(2)) },
    ];
  }, [twr, period]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Time-Weighted Return (TWR)
        </h2>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: period === p ? "#22c55e22" : "transparent",
                color: period === p ? "#22c55e" : "var(--muted)",
                border: `1px solid ${period === p ? "#22c55e55" : "var(--border)"}`,
              }}
              aria-pressed={period === p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            TWR Performance
          </p>
          <p
            className="text-3xl font-bold mb-4"
            style={{ color: twr >= 0 ? "#22c55e" : "#ef4444" }}
          >
            {twr >= 0 ? "+" : ""}{twr.toFixed(2)}%
          </p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(ts) => getXTickFormat(period, ts)}
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                  labelFormatter={(ts) => format(ts, "MMM d, yyyy")}
                  formatter={(val: number) => [`${val.toFixed(2)}%`, "Return"]}
                />
                <Line
                  type="monotone"
                  dataKey="return"
                  stroke={twr >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Market TWR Comparison
          </p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                  formatter={(val: number) => [`${val.toFixed(2)}%`, "TWR"]}
                />
                <Bar
                  dataKey="twr"
                  strokeWidth={0}
                >
                  {marketComparisonData.map((entry, index) => (
                    <rect
                      key={index}
                      fill={entry.name === "Portfolio" ? "#3b82f6" : "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
