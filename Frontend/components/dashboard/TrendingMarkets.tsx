"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TrendingMarket {
    id: string;
    title: string;
    description: string;
    status: "open" | "closed" | "resolved" | "disputed";
    yesPrice: number;
    noPrice: number;
    volume: number;
    liquidity: number;
    activityScore: number;
}

export default function TrendingMarkets() {
    const [markets, setMarkets] = useState<TrendingMarket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadTrending() {
            try {
                setIsLoading(true);
                const response = await fetch("/api/trending-markets");
                if (!response.ok) throw new Error("Failed to load trending markets");
                const data = await response.json();
                setMarkets(data.markets ?? []);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        }

        loadTrending();
        const interval = window.setInterval(loadTrending, 15000);
        return () => window.clearInterval(interval);
    }, []);

    return (
        <section className="rounded-3xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Trending markets</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Popular markets with the highest recent activity and volume.
                    </p>
                </div>
                <p className="text-xs text-slate-500">Updated every 15 seconds</p>
            </div>

            {isLoading ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((index) => (
                        <div key={index} className="animate-pulse rounded-3xl bg-slate-100 p-4" />
                    ))}
                </div>
            ) : error ? (
                <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    {error}
                </div>
            ) : (
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {markets.map((market) => (
                        <Link
                            key={market.id}
                            href={`/markets/${market.id}`}
                            className="group block rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                            style={{ background: "var(--background)", borderColor: "var(--border)" }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">Trending</p>
                                    <h3 className="mt-2 text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                                        {market.title}
                                    </h3>
                                </div>
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-[0.7rem] font-semibold text-blue-700">
                                    +{market.activityScore}%
                                </span>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-slate-500">{market.description}</p>

                            <div className="mt-4 grid gap-3 text-xs">
                                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                                    <span style={{ color: "var(--muted)" }}>Volume</span>
                                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>${market.volume.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                                    <span style={{ color: "var(--muted)" }}>Liquidity</span>
                                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>${market.liquidity.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                <span>{market.status === "open" ? "Open" : market.status === "resolved" ? "Resolved" : "Closed"}</span>
                                <span className="font-medium text-blue-600">View details →</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
