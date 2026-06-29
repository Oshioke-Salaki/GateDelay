"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays, subHours } from "date-fns";

type Timeframe = "24h" | "7d" | "30d";

interface VolumeStatsProps {
  marketId: string;
}

// Generate realistic-looking volume data
function generateMockData(timeframe: Timeframe) {
  const data = [];
  const now = new Date();
  
  let points = 24;
  let isHourly = false;
  
  if (timeframe === "24h") {
    points = 24;
    isHourly = true;
  } else if (timeframe === "7d") {
    points = 7;
  } else if (timeframe === "30d") {
    points = 30;
  }

  let baseVolume = timeframe === "24h" ? 500 : 5000;

  for (let i = points; i >= 0; i--) {
    const date = isHourly ? subHours(now, i) : subDays(now, i);
    // Add some random noise and a slight upward trend
    const noise = Math.random() * 0.5 + 0.75;
    const trend = 1 + ((points - i) / points) * 0.5;
    const volume = Math.floor(baseVolume * noise * trend);
    
    data.push({
      date,
      displayDate: isHourly ? format(date, "HH:mm") : format(date, "MMM dd"),
      volume,
    });
  }
  
  return data;
}

export default function VolumeStats({ marketId }: VolumeStatsProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");

  const data = useMemo(() => generateMockData(timeframe), [timeframe]);
  
  const currentTotal = useMemo(() => data.reduce((acc, curr) => acc + curr.volume, 0), [data]);
  const averageVolume = currentTotal / data.length;
  
  // Create a stable random percentage diff for demonstration between -20% and +30%
  const diffPercent = useMemo(() => {
    // Deterministic random based on marketId and timeframe string
    const seed = marketId.charCodeAt(0) + timeframe.length;
    const rand = Math.sin(seed) * 25 + 5; 
    return rand;
  }, [marketId, timeframe]);
  
  const isPositive = diffPercent >= 0;

  // Breakdown for Pie Chart
  const pieData = useMemo(() => {
    const yesVol = currentTotal * 0.62;
    const noVol = currentTotal * 0.38;
    return [
      { name: "YES", value: yesVol, color: "#22c55e" }, // Green
      { name: "NO", value: noVol, color: "#ef4444" }, // Red
    ];
  }, [currentTotal]);

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl shadow-sm font-sans w-full" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Volume Statistics</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Trading activity for this market</p>
        </div>
        
        <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1" style={{ border: "1px solid var(--border)" }}>
          {(["24h", "7d", "30d"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeframe === tf 
                  ? "shadow-sm" 
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={{ 
                background: timeframe === tf ? "var(--background)" : "transparent",
                color: timeframe === tf ? "var(--foreground)" : "var(--muted)"
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>Total Volume ({timeframe})</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{formatCurrency(currentTotal)}</span>
          </div>
        </div>
        
        <div className="p-4 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>Average {timeframe === "24h" ? "Hourly" : "Daily"} Vol</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{formatCurrency(Math.floor(averageVolume))}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>vs Historical Average</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{diffPercent.toFixed(1)}%
            </span>
            <span className="text-sm" style={{ color: "var(--muted)" }}>{isPositive ? "above avg" : "below avg"}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 flex flex-col">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>Volume Trend</h3>
          <div className="w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--muted)", fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                  itemStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  labelStyle={{ color: "var(--muted)", marginBottom: "4px" }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Volume"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVol)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Pie Chart */}
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>Outcome Distribution</h3>
          <div className="w-full h-[250px] sm:h-[300px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value, entry) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label for Doughnut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-xs" style={{ color: "var(--muted)" }}>Total</span>
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{formatCurrency(currentTotal)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
