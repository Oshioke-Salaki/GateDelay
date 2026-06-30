"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolatilityPoint {
  timestamp: number;    // unix ms
  price: number;
  /** Annualised realised volatility (0–1, e.g. 0.35 = 35%) */
  volatility: number;
  /** Upper Bollinger Band */
  upperBand: number;
  /** Lower Bollinger Band */
  lowerBand: number;
  /** Simple moving average (middle band) */
  sma: number;
  /** ATR value */
  atr: number;
  /** Trading volume */
  volume: number;
}

type Timeframe = "1H" | "4H" | "1D" | "1W" | "1M";

interface VolatilityChartProps {
  data?: VolatilityPoint[];
  /** Accent color for volatility indicator */
  accentColor?: string;
  /** Title shown in the header */
  title?: string;
  /** Whether to show real-time pulsing indicator */
  isLive?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ["1H", "4H", "1D", "1W", "1M"];

const TIMEFRAME_HOURS: Record<Timeframe, number> = {
  "1H": 1,
  "4H": 4,
  "1D": 24,
  "1W": 24 * 7,
  "1M": 24 * 30,
};

const TIMEFRAME_INTERVAL_MINUTES: Record<Timeframe, number> = {
  "1H": 1,
  "4H": 5,
  "1D": 30,
  "1W": 240,
  "1M": 1440,
};

// ─── Mock data generator ──────────────────────────────────────────────────────

function generateVolatilityData(timeframe: Timeframe): VolatilityPoint[] {
  const now = Date.now();
  const totalHours = TIMEFRAME_HOURS[timeframe];
  const intervalMinutes = TIMEFRAME_INTERVAL_MINUTES[timeframe];
  const totalPoints = Math.floor((totalHours * 60) / intervalMinutes);

  const points: VolatilityPoint[] = [];
  let price = 1.0;
  let volatility = 0.3;

  // Price history for Bollinger Band / SMA calculation
  const priceWindow: number[] = [];
  const BAND_PERIOD = Math.min(20, Math.floor(totalPoints / 4));

  for (let i = totalPoints; i >= 0; i--) {
    const ts = now - i * intervalMinutes * 60 * 1000;

    // Simulate price walk with regime changes
    const shock = (Math.random() - 0.49) * 0.015;
    price = Math.max(0.05, Math.min(2.5, price + shock));
    priceWindow.push(price);
    if (priceWindow.length > BAND_PERIOD) priceWindow.shift();

    // Realised volatility: mean-reverting with occasional spikes
    const volShock = (Math.random() - 0.48) * 0.04;
    volatility = Math.max(0.05, Math.min(0.95, volatility + volShock));

    // Bollinger Bands
    const sma =
      priceWindow.reduce((a, b) => a + b, 0) / priceWindow.length;
    const stdDev = Math.sqrt(
      priceWindow.reduce((acc, p) => acc + (p - sma) ** 2, 0) /
        priceWindow.length,
    );
    const bandWidth = stdDev * 2;

    points.push({
      timestamp: ts,
      price: parseFloat(price.toFixed(4)),
      volatility: parseFloat(volatility.toFixed(4)),
      upperBand: parseFloat((sma + bandWidth).toFixed(4)),
      lowerBand: parseFloat(Math.max(0, sma - bandWidth).toFixed(4)),
      sma: parseFloat(sma.toFixed(4)),
      atr: parseFloat((stdDev * Math.sqrt(14)).toFixed(4)),
      volume: Math.floor(Math.random() * 500 + 50),
    });
  }
  return points;
}

// ─── X-axis tick formatter ────────────────────────────────────────────────────

function xTickFormat(timeframe: Timeframe, ts: number): string {
  switch (timeframe) {
    case "1H":  return format(ts, "HH:mm");
    case "4H":  return format(ts, "HH:mm");
    case "1D":  return format(ts, "HH:mm");
    case "1W":  return format(ts, "EEE dd");
    case "1M":  return format(ts, "MMM d");
  }
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: number;
}) {
  if (!active || !payload?.length || typeof label !== "number") return null;

  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs shadow-lg min-w-[160px]"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }}
    >
      <p className="mb-2 font-medium" style={{ color: "var(--muted)" }}>
        {format(label, "MMM d, HH:mm")}
      </p>
      {get("price") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Price</span>
          <span className="font-semibold">{get("price")?.toFixed(4)}</span>
        </p>
      )}
      {get("volatility") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Volatility</span>
          <span className="font-semibold" style={{ color: "#f59e0b" }}>
            {((get("volatility") ?? 0) * 100).toFixed(1)}%
          </span>
        </p>
      )}
      {get("upperBand") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Upper band</span>
          <span>{get("upperBand")?.toFixed(4)}</span>
        </p>
      )}
      {get("lowerBand") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Lower band</span>
          <span>{get("lowerBand")?.toFixed(4)}</span>
        </p>
      )}
      {get("atr") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>ATR</span>
          <span>{get("atr")?.toFixed(4)}</span>
        </p>
      )}
      {get("volume") !== undefined && (
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Volume</span>
          <span>{get("volume")?.toLocaleString()}</span>
        </p>
      )}
    </div>
  );
}

// ─── Volatility Legend ────────────────────────────────────────────────────────

function VolatilityLegend({ value }: { value: number }) {
  const pct = value * 100;
  const level =
    pct < 20 ? { label: "Low", color: "#22c55e" } :
    pct < 40 ? { label: "Moderate", color: "#3b82f6" } :
    pct < 60 ? { label: "High", color: "#f59e0b" } :
               { label: "Extreme", color: "#ef4444" };

  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: level.color }}
        aria-hidden="true"
      />
      <span className="text-xs font-medium" style={{ color: level.color }}>
        {level.label} ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VolatilityChart({
  data,
  accentColor = "#f59e0b",
  title = "Market Volatility",
  isLive = false,
}: VolatilityChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  // Use provided data or generate mock data per timeframe
  const chartData = useMemo(
    () => data ?? generateVolatilityData(timeframe),
    [data, timeframe],
  );

  // Downsample for perf: keep at most 500 points
  const displayData = useMemo(() => {
    if (chartData.length <= 500) return chartData;
    const step = Math.ceil(chartData.length / 500);
    return chartData.filter((_, i) => i % step === 0);
  }, [chartData]);

  const latest = displayData[displayData.length - 1];

  // Current volatility regime colors
  const currentVolPct = (latest?.volatility ?? 0) * 100;
  const volColor =
    currentVolPct < 20 ? "#22c55e" :
    currentVolPct < 40 ? "#3b82f6" :
    currentVolPct < 60 ? "#f59e0b" :
    "#ef4444";

  // Bandwidth (upper - lower) trend for stats
  const currentBandwidth = latest
    ? ((latest.upperBand - latest.lowerBand) / latest.sma) * 100
    : 0;

  const xFormatter = (ts: number) => xTickFormat(timeframe, ts);

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </p>
              {isLive && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: "#22c55e" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {latest && <VolatilityLegend value={latest.volatility} />}
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="rounded-md px-2.5 py-1 text-xs transition-colors"
              style={{
                background: timeframe === tf ? `${accentColor}22` : "transparent",
                color: timeframe === tf ? accentColor : "var(--muted)",
                border: `1px solid ${timeframe === tf ? `${accentColor}55` : "var(--border)"}`,
              }}
              aria-pressed={timeframe === tf}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Realised Vol",
            value: `${currentVolPct.toFixed(1)}%`,
            color: volColor,
          },
          {
            label: "Band Width",
            value: `${currentBandwidth.toFixed(2)}%`,
            color: "var(--foreground)",
          },
          {
            label: "ATR",
            value: latest?.atr?.toFixed(4) ?? "—",
            color: "var(--foreground)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-3"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {stat.label}
            </p>
            <p
              className="mt-1 text-base font-semibold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Price + Bollinger Bands chart */}
      <div>
        <p className="mb-2 text-xs font-medium" style={{ color: "var(--muted)" }}>
          Price with Bollinger Bands (20-period, 2σ)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={displayData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.12} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={xFormatter}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => v.toFixed(3)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
              formatter={(v) => (
                <span style={{ color: "var(--muted)" }}>{v}</span>
              )}
            />
            {/* Band fill area between upper and lower */}
            <Area
              type="monotone"
              dataKey="upperBand"
              name="Upper band"
              stroke={accentColor}
              strokeWidth={1.2}
              strokeDasharray="4 3"
              fill="url(#bandFill)"
              dot={false}
              legendType="none"
              isAnimationActive={displayData.length < 300}
            />
            <Area
              type="monotone"
              dataKey="lowerBand"
              name="Lower band"
              stroke={accentColor}
              strokeWidth={1.2}
              strokeDasharray="4 3"
              fill="transparent"
              dot={false}
              legendType="none"
              isAnimationActive={displayData.length < 300}
            />
            {/* SMA */}
            <Line
              type="monotone"
              dataKey="sma"
              name="SMA(20)"
              stroke={accentColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={displayData.length < 300}
            />
            {/* Price */}
            <Line
              type="monotone"
              dataKey="price"
              name="Price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={displayData.length < 300}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volatility indicator chart */}
      <div>
        <p className="mb-2 text-xs font-medium" style={{ color: "var(--muted)" }}>
          Realised Volatility (annualised)
        </p>
        <ResponsiveContainer width="100%" height={90}>
          <ComposedChart
            data={displayData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={volColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={volColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              hide
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 9, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} />
            {/* Regime reference lines */}
            <ReferenceLine y={0.2} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={0.4} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={0.6} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Area
              type="monotone"
              dataKey="volatility"
              name="Volatility"
              stroke={volColor}
              fill="url(#volFill)"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={displayData.length < 300}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
          Reference lines: 20% (low) · 40% (moderate) · 60% (high)
        </p>
      </div>

      {/* Volume bars */}
      <div>
        <p className="mb-1 text-xs font-medium" style={{ color: "var(--muted)" }}>
          Volume
        </p>
        <ResponsiveContainer width="100%" height={48}>
          <ComposedChart
            data={displayData}
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              hide
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="volume"
              name="Volume"
              fill={accentColor}
              opacity={0.45}
              radius={[2, 2, 0, 0]}
              isAnimationActive={displayData.length < 300}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
