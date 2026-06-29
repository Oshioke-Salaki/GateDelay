"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@particle-network/connectkit";
import { format, subDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeeEntry {
  date: number;       // unix ms
  lpFees: number;     // USDC earned from LP provision
  tradingFees: number; // USDC earned from trading rebates
}

export interface EarnedFeesData {
  claimable: number;
  totalLp: number;
  totalTrading: number;
  history: FeeEntry[];
}

// ─── Mock fetch (replace with real API / contract call) ───────────────────────

function generateMockFees(): EarnedFeesData {
  const now = Date.now();
  const history: FeeEntry[] = Array.from({ length: 30 }, (_, i) => ({
    date: subDays(now, 29 - i).getTime(),
    lpFees: parseFloat((Math.random() * 4).toFixed(2)),
    tradingFees: parseFloat((Math.random() * 1.5).toFixed(2)),
  }));
  const totalLp = parseFloat(history.reduce((s, e) => s + e.lpFees, 0).toFixed(2));
  const totalTrading = parseFloat(history.reduce((s, e) => s + e.tradingFees, 0).toFixed(2));
  return { claimable: parseFloat((totalLp * 0.3).toFixed(2)), totalLp, totalTrading, history };
}

async function fetchEarnedFees(_address: string): Promise<EarnedFeesData> {
  // TODO: replace with real API/contract call using _address
  await new Promise((r) => setTimeout(r, 400));
  return generateMockFees();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex-1 rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-[120px]"
      style={{
        background: highlight ? "#22c55e14" : "var(--card)",
        border: `1px solid ${highlight ? "#22c55e44" : "var(--border)"}`,
      }}
    >
      <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
      <p
        className="text-base font-bold tabular-nums"
        style={{ color: highlight ? "#22c55e" : "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  );
}

// Simple inline bar chart — no extra library needed
function HistoryBars({ history }: { history: FeeEntry[] }) {
  const max = Math.max(...history.map((e) => e.lpFees + e.tradingFees), 0.01);
  // Show last 14 entries to keep it compact
  const visible = history.slice(-14);

  return (
    <div className="flex items-end gap-0.5 h-16" aria-label="Fee history chart" role="img">
      {visible.map((entry) => {
        const total = entry.lpFees + entry.tradingFees;
        const lpH = (entry.lpFees / max) * 100;
        const tradeH = (entry.tradingFees / max) * 100;
        return (
          <div
            key={entry.date}
            className="flex-1 flex flex-col justify-end gap-px"
            title={`${format(entry.date, "MMM d")}: LP ${usd(entry.lpFees)} + Trading ${usd(entry.tradingFees)} = ${usd(total)}`}
          >
            <div style={{ height: `${tradeH}%`, background: "#3b82f6", borderRadius: "2px 2px 0 0", minHeight: tradeH > 0 ? 2 : 0 }} />
            <div style={{ height: `${lpH}%`, background: "#22c55e", borderRadius: tradeH > 0 ? 0 : "2px 2px 0 0", minHeight: lpH > 0 ? 2 : 0 }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EarnedFees() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, isError, dataUpdatedAt, refetch } = useQuery<EarnedFeesData>({
    queryKey: ["earnedFees", address],
    queryFn: () => fetchEarnedFees(address as string),
    enabled: isConnected && !!address,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  if (!isConnected) {
    return (
      <div
        className="rounded-xl px-4 py-6 text-sm text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        Connect your wallet to view earned fees.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Earned Fees</p>
          {dataUpdatedAt > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Updated {format(dataUpdatedAt, "HH:mm:ss")}
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          aria-label="Refresh fees"
          className="rounded-lg p-1.5 transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "var(--muted)" }}
        >
          {/* Refresh icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {isError && (
          <p className="text-xs text-center" style={{ color: "#ef4444" }}>
            Failed to load fee data. <button onClick={() => refetch()} className="underline">Retry</button>
          </p>
        )}

        {/* Stat cards */}
        <div className="flex flex-wrap gap-2">
          <StatCard
            label="Claimable"
            value={isLoading ? "—" : usd(data?.claimable ?? 0)}
            highlight
          />
          <StatCard label="LP Fees (30d)" value={isLoading ? "—" : usd(data?.totalLp ?? 0)} />
          <StatCard label="Trading Fees (30d)" value={isLoading ? "—" : usd(data?.totalTrading ?? 0)} />
          <StatCard
            label="Total Earned (30d)"
            value={isLoading ? "—" : usd((data?.totalLp ?? 0) + (data?.totalTrading ?? 0))}
          />
        </div>

        {/* Claim button */}
        {!isLoading && (data?.claimable ?? 0) > 0 && (
          <button
            className="w-full rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#22c55e" }}
            onClick={() => {
              // TODO: wire to contract claim call
              alert(`Claiming ${usd(data!.claimable)}`);
            }}
          >
            Claim {usd(data!.claimable)}
          </button>
        )}

        {/* History chart */}
        {!isLoading && data && (
          <div>
            <p className="text-xs mb-2 font-medium" style={{ color: "var(--muted)" }}>
              Daily earnings — last 14 days
            </p>
            <HistoryBars history={data.history} />
            {/* Legend */}
            <div className="flex gap-4 mt-2">
              {[{ color: "#22c55e", label: "LP fees" }, { color: "#3b82f6", label: "Trading fees" }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History table */}
        {!isLoading && data && (
          <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Recent history</p>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {[...data.history].reverse().slice(0, 10).map((entry) => (
                <div key={entry.date} className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--muted)" }}>{format(entry.date, "MMM d")}</span>
                  <div className="flex gap-3">
                    <span style={{ color: "#22c55e" }}>LP {usd(entry.lpFees)}</span>
                    <span style={{ color: "#3b82f6" }}>Trade {usd(entry.tradingFees)}</span>
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {usd(entry.lpFees + entry.tradingFees)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-6">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Loading">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
