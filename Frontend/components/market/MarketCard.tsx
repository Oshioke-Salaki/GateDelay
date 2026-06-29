"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import StatusIndicator, { MarketStatus } from "./StatusIndicator";

export interface Market {
  id: string;
  title: string;
  description: string;
  status: MarketStatus;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  image?: string;
}

interface MarketCardProps {
  market: Market;
  /** Called when the card is clicked (in addition to navigation) */
  onClick?: (market: Market) => void;
}

export default function MarketCard({ market, onClick }: MarketCardProps) {
  // Simulate real-time price updates (replace with actual subscription/polling)
  const [prices, setPrices] = useState({ yes: market.yesPrice, no: market.noPrice });

  useEffect(() => {
    if (market.status !== "open") return;
    const id = setInterval(() => {
      setPrices({ yes: market.yesPrice, no: market.noPrice });
    }, 5000);
    return () => clearInterval(id);
  }, [market.yesPrice, market.noPrice, market.status]);

  const status = market.status;

  return (
    <Link
      href={`/markets/${market.id}`}
      onClick={() => onClick?.(market)}
      className="group flex flex-col rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Image */}
      {market.image ? (
        <img
          src={market.image}
          alt={market.title}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div
          className="w-full h-32 flex items-center justify-center text-3xl select-none"
          style={{ background: "var(--border)" }}
          aria-hidden
        >
          ✈️
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Status + title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <StatusIndicator status={status} resolvedAt={market.resolvedAt} outcome={market.outcome} variant="full" />
            </div>
            <h3
              className="font-semibold text-sm leading-snug line-clamp-2"
              style={{ color: "var(--foreground)" }}
            >
              {market.title}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs line-clamp-2" style={{ color: "var(--muted)" }}>
          {market.description}
        </p>

        {/* Prices */}
        <div className="flex gap-2">
          <div
            className="flex-1 rounded-lg px-3 py-2 text-center"
            style={{ background: "#22c55e18", border: "1px solid #22c55e44" }}
          >
            <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>YES</p>
            <p className="text-sm font-bold" style={{ color: "#22c55e" }}>
              {(prices.yes * 100).toFixed(0)}¢
            </p>
          </div>
          <div
            className="flex-1 rounded-lg px-3 py-2 text-center"
            style={{ background: "#ef444418", border: "1px solid #ef444444" }}
          >
            <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>NO</p>
            <p className="text-sm font-bold" style={{ color: "#ef4444" }}>
              {(prices.no * 100).toFixed(0)}¢
            </p>
          </div>
        </div>

        {/* Volume + Liquidity */}
        <div className="flex justify-between text-xs pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted)" }}>
            Vol <span style={{ color: "var(--foreground)" }}>${market.volume.toLocaleString()}</span>
          </span>
          <span style={{ color: "var(--muted)" }}>
            Liq <span style={{ color: "var(--foreground)" }}>${market.liquidity.toLocaleString()}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
