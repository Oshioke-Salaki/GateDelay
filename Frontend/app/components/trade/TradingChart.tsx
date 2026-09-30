"use client";

import { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

// ─── Trading Chart ────────────────────────────────────────────────────────────

interface TradingChartProps {
    marketId: string;
}

export default function TradingChart({ marketId }: TradingChartProps) {
    const [timeframe, setTimeframe] = useState<"1H" | "24H" | "7D" | "30D" | "ALL">("24H");
    const [chartType, setChartType] = useState<"line" | "area">("area");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const id = window.setTimeout(() => setIsLoading(false), 350);
        return () => window.clearTimeout(id);
    }, [marketId, timeframe]);

    // Mock data - in production, this would come from API
    const chartData = useMemo(() => {
        const now = Date.now();
        const points = timeframe === "1H" ? 60 : timeframe === "24H" ? 24 : timeframe === "7D" ? 7 : 30;
        const interval = timeframe === "1H" ? 60000 : timeframe === "24H" ? 3600000 : 86400000;

        return Array.from({ length: points }, (_, i) => {
            const timestamp = now - (points - i) * interval;
            const basePrice = 1.0;
            const volatility = 0.1;
            const trend = i * 0.001;
            const noise = (Math.random() - 0.5) * volatility;
            const price = basePrice + trend + noise;

            return {
                timestamp,
                time: new Date(timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                price: parseFloat(price.toFixed(4)),
                volume: Math.floor(Math.random() * 10000) + 5000,
            };
        });
    }, [timeframe]);

    const timeframes = [
        { value: "1H" as const, label: "1H" },
        { value: "24H" as const, label: "24H" },
        { value: "7D" as const, label: "7D" },
        { value: "30D" as const, label: "30D" },
        { value: "ALL" as const, label: "ALL" },
    ];

    const currentPrice = chartData[chartData.length - 1]?.price || 0;
    const previousPrice = chartData[0]?.price || 0;
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = (priceChange / previousPrice) * 100;

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6" role="status" aria-busy="true" aria-label="Loading market price chart">
                <div className="flex items-center justify-between mb-6">
                    <div className="space-y-3">
                        <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
                        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((item) => (
                            <div key={item} className="h-7 w-10 rounded bg-gray-200 animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="h-96 rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex h-full items-end gap-2">
                        {Array.from({ length: 24 }).map((_, index) => (
                            <div
                                key={index}
                                className="flex-1 rounded-t bg-gray-200 animate-pulse"
                                style={{ height: `${28 + ((index * 17) % 58)}%` }}
                            />
                        ))}
                    </div>
                </div>
                <span className="sr-only">Loading market price chart</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Chart Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Price Chart</h2>
                    <div className="flex items-center space-x-2 mt-1">
                        <span className="text-2xl font-bold text-gray-900">
                            ${currentPrice.toFixed(4)}
                        </span>
                        <span
                            className={`text-sm font-semibold ${priceChange >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            {priceChange >= 0 ? "+" : ""}
                            {priceChange.toFixed(4)} ({priceChangePercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center space-x-2">
                    {timeframes.map((tf) => (
                        <button
                            key={tf.value}
                            onClick={() => setTimeframe(tf.value)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${timeframe === tf.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === "area" ? (
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                        offset="5%"
                                        stopColor={priceChange >= 0 ? "#10b981" : "#ef4444"}
                                        stopOpacity={0.3}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor={priceChange >= 0 ? "#10b981" : "#ef4444"}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="time"
                                stroke="#6b7280"
                                style={{ fontSize: "12px" }}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6b7280"
                                style={{ fontSize: "12px" }}
                                tickLine={false}
                                domain={["auto", "auto"]}
                                tickFormatter={(value) => `$${value.toFixed(2)}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    padding: "12px",
                                }}
                                formatter={(value: any) => [`$${Number(value ?? 0).toFixed(4)}`, "Price"]}
                                labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={priceChange >= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth={2}
                                fill="url(#colorPrice)"
                            />
                        </AreaChart>
                    ) : (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="time"
                                stroke="#6b7280"
                                style={{ fontSize: "12px" }}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6b7280"
                                style={{ fontSize: "12px" }}
                                tickLine={false}
                                domain={["auto", "auto"]}
                                tickFormatter={(value) => `$${value.toFixed(2)}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    padding: "12px",
                                }}
                                formatter={(value: any) => [`$${Number(value ?? 0).toFixed(4)}`, "Price"]}
                                labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                            />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke={priceChange >= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Chart Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setChartType("area")}
                        className={`px-3 py-1 rounded text-sm font-medium ${chartType === "area"
                                ? "bg-blue-100 text-blue-700"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        Area
                    </button>
                    <button
                        onClick={() => setChartType("line")}
                        className={`px-3 py-1 rounded text-sm font-medium ${chartType === "line"
                                ? "bg-blue-100 text-blue-700"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        Line
                    </button>
                </div>

                <div className="text-xs text-gray-500">
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}
