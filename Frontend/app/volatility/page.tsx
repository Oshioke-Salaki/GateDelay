import type { Metadata } from "next";
import VolatilityClient from "./VolatilityClient";

export const metadata: Metadata = {
  title: "Volatility | GateDelay",
  description: "Real-time market volatility analysis with Bollinger Bands, ATR indicators, and regime detection.",
};

export default function VolatilityPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Market Volatility
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Realised volatility, Bollinger Bands, and ATR across multiple timeframes.
        </p>
      </div>
      <VolatilityClient />
    </main>
  );
}
