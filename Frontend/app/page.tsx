import FlightSearchAutocomplete from "./components/FlightSearchAutocomplete";
import Link from "next/link";
import { Suspense } from "react";
import { MarketListSkeleton } from "./components/ui/Skeleton";
import QuickTradeWidget from "../components/trade/QuickTradeWidget";
import { formatOdds, formatVolume } from "@/lib/formatters";
import { Compass, Search } from "lucide-react";

// Replace with a real API call (e.g. fetch /api/markets) once the backend
// market-list endpoint is available.
type HomeMarket = {
  id: string;
  title: string;
  yesPrice: number;
  volume: number;
};

const SAMPLE_MARKETS: HomeMarket[] = [];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Predict flight outcomes
        </h1>
        <p className="text-base" style={{ color: "var(--muted)" }}>
          Trade YES/NO on flight delays and cancellations, powered by Mantle.
        </p>
      </div>

      {/* Search */}
      <FlightSearchAutocomplete placeholder="Search by flight number (e.g. AA123)…" />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Markets (takes 2 cols) */}
        <section className="md:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "var(--muted)" }}>
            ACTIVE MARKETS
          </h2>
          <Suspense fallback={<MarketListSkeleton count={3} />}>
            <div className="space-y-2">
              {SAMPLE_MARKETS.map((m) => (
                <Link
                  key={m.id}
                  href={`/markets/${m.id}`}
                  className="flex items-center justify-between rounded-xl px-5 py-4 transition-opacity hover:opacity-80"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      Vol: {formatVolume(m.volume)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                      YES {formatOdds(m.yesPrice)}
                    </p>
                    <p className="text-xs" style={{ color: "#ef4444" }}>
                      NO {formatOdds(1 - m.yesPrice)}
                    </p>
                  </div>
                </Link>
              ))}
              {SAMPLE_MARKETS.length === 0 && (
                <div
                  className="rounded-lg border px-5 py-6"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    No active markets to show yet
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    Search for a market or browse the full market list. You can favorite markets to keep them close.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                      style={{ background: "#2563eb", color: "white" }}
                    >
                      <Compass size={15} aria-hidden="true" />
                      Browse markets
                    </Link>
                    <Link
                      href="/markets/search"
                      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      <Search size={15} aria-hidden="true" />
                      Search markets
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Suspense>
        </section>

        {/* Quick Trade Widget (takes 1 col) */}
        <div className="md:col-span-1">
          <QuickTradeWidget />
        </div>
      </div>
    </main>
  );
}
