import FlightSearchAutocomplete from "./components/FlightSearchAutocomplete";
import Link from "next/link";
import { Suspense } from "react";
import { MarketListSkeleton } from "./components/ui/Skeleton";

const SAMPLE_MARKETS = [
  { id: "1", title: "Will AA123 arrive on time?", yesPrice: 0.62, volume: 14820, status: "open" },
  { id: "2", title: "Will UA456 be delayed > 30 min?", yesPrice: 0.41, volume: 8300, status: "open" },
  { id: "3", title: "Will DL789 be cancelled?", yesPrice: 0.08, volume: 3200, status: "open" },
];

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-10">
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

      {/* Markets */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>
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
                  Vol: ${m.volume.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                  YES {(m.yesPrice * 100).toFixed(0)}¢
                </p>
                <p className="text-xs" style={{ color: "#ef4444" }}>
                  NO {((1 - m.yesPrice) * 100).toFixed(0)}¢
                </p>
              </div>
            </Link>
          ))}
        </div>
        </Suspense>
      </section>
    </main>
  );
}
