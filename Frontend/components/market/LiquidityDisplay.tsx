"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    AreaChart,
    Area,
} from "recharts";

interface LiquidityDisplayProps {
    marketId: string;
}

interface VolumePoint {
    label: string;
    volume: number;
}

interface DepthPoint {
    priceLevel: string;
    depth: number;
}

const LOW_LIQUIDITY_THRESHOLD = 3200;
const INITIAL_POOL_BALANCE = 5400;
const INITIAL_VOLUME = {
    "24H": 14820,
    "7D": 51200,
    "30D": 118500,
};

function getDepthLevels(poolBalance: number): DepthPoint[] {
    const levels = ["Deep", "Strong", "Moderate", "Shallow", "Thin"];
    return levels.map((label, index) => ({
        priceLevel: label,
        depth: Math.max(200, Math.round(poolBalance * (0.24 - index * 0.03))),
    }));
}

function getVolumeSeries(baseVolume: number): VolumePoint[] {
    return [
        { label: "Mon", volume: Math.max(2200, baseVolume * 0.08 + Math.round(Math.random() * 300)) },
        { label: "Tue", volume: Math.max(2200, baseVolume * 0.11 + Math.round(Math.random() * 300)) },
        { label: "Wed", volume: Math.max(2300, baseVolume * 0.14 + Math.round(Math.random() * 300)) },
        { label: "Thu", volume: Math.max(2400, baseVolume * 0.12 + Math.round(Math.random() * 300)) },
        { label: "Fri", volume: Math.max(2500, baseVolume * 0.15 + Math.round(Math.random() * 300)) },
        { label: "Sat", volume: Math.max(1800, baseVolume * 0.10 + Math.round(Math.random() * 200)) },
        { label: "Sun", volume: Math.max(1900, baseVolume * 0.10 + Math.round(Math.random() * 200)) },
    ];
}

export default function LiquidityDisplay({ marketId }: LiquidityDisplayProps) {
    const [poolBalance, setPoolBalance] = useState(INITIAL_POOL_BALANCE);
    const [volume24H, setVolume24H] = useState(INITIAL_VOLUME["24H"]);
    const [volume7D, setVolume7D] = useState(INITIAL_VOLUME["7D"]);
    const [volume30D, setVolume30D] = useState(INITIAL_VOLUME["30D"]);
    const [volumeSeries, setVolumeSeries] = useState<VolumePoint[]>(() => getVolumeSeries(INITIAL_VOLUME["24H"]));

    useEffect(() => {
        const interval = window.setInterval(() => {
            setPoolBalance((current) => {
                const delta = Math.round((Math.random() - 0.5) * 260);
                return Math.max(1800, current + delta);
            });
            setVolume24H((current) => {
                const next = Math.max(7000, current + Math.round((Math.random() - 0.5) * 900));
                setVolumeSeries(getVolumeSeries(next));
                return next;
            });
            setVolume7D((current) => Math.max(35000, current + Math.round((Math.random() - 0.5) * 2600)));
            setVolume30D((current) => Math.max(85000, current + Math.round((Math.random() - 0.5) * 4000)));
        }, 5000);

        return () => window.clearInterval(interval);
    }, []);

    const depthData = useMemo(() => getDepthLevels(poolBalance), [poolBalance]);

    const lowLiquidity = poolBalance < LOW_LIQUIDITY_THRESHOLD;

    return (
        <div className="rounded-xl p-5 space-y-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Market liquidity · #{marketId}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Live pool balance, volume and depth data for this market.
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center sm:text-right">
                    {[
                        { label: "Pool balance", value: `$${poolBalance.toLocaleString()}` },
                        { label: "24h volume", value: `$${volume24H.toLocaleString()}` },
                        { label: "7d volume", value: `$${volume7D.toLocaleString()}` },
                        { label: "30d volume", value: `$${volume30D.toLocaleString()}` },
                    ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 p-3" style={{ background: "var(--background)" }}>
                            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                            <p className="mt-2 font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Liquidity depth</p>
                        <span className="text-xs text-slate-500">Updated live</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={depthData} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="priceLevel" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                                <Tooltip
                                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                                    contentStyle={{
                                        background: "var(--card)",
                                        border: "1px solid var(--border)",
                                        color: "var(--foreground)",
                                    }}
                                />
                                <Bar dataKey="depth" fill="#2563eb" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Volume trend</p>
                        <span className="text-xs text-slate-500">7-day view</span>
                    </div>
                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={volumeSeries} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip
                                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                                    contentStyle={{
                                        background: "var(--card)",
                                        border: "1px solid var(--border)",
                                        color: "var(--foreground)",
                                    }}
                                />
                                <Area type="monotone" dataKey="volume" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.5} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                        <p>
                            Market {lowLiquidity ? "shows low liquidity" : "has healthy liquidity"} for this pool.
                        </p>
                        <p>
                            Pool depth charts help you understand available order capacity before placing larger trades.
                        </p>
                    </div>
                </div>
            </div>

            {lowLiquidity ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Low liquidity warning</p>
                    <p className="mt-2 text-xs text-amber-900/90">
                        This market has a smaller liquidity pool than normal. Trades may experience increased slippage and price impact.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
