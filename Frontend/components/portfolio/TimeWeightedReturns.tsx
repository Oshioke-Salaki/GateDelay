"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { subWeeks, subMonths, format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getAccessToken } from "@/lib/portfolioApi";
import { calculateTWR, type CashFlow, type PortfolioValue } from "@/lib/timeWeightedReturns";
export { calculateTWR } from "@/lib/timeWeightedReturns";

interface AccountHistory {
  values: PortfolioValue[];
  cashFlows: CashFlow[];
  /** Source guarantees all external deposits and withdrawals are included. */
  cashFlowsComplete: boolean;
}
type Period = "1W" | "1M" | "3M" | "1Y" | "ALL";
const PERIODS: Period[] = ["1W", "1M", "3M", "1Y", "ALL"];

export default function TimeWeightedReturns({ history: suppliedHistory }: { history?: AccountHistory } = {}) {
  const { address, chainId } = useAccount();
  const identity = address ? address.toLowerCase() + ":" + chainId : "";
  const [period, setPeriod] = useState<Period>("3M");
  const [state, setState] = useState<{ identity: string; history: AccountHistory | null; message: string }>({ identity: "", history: null, message: "Loading account history…" });
  useEffect(() => {
    if (suppliedHistory) return;
    const controller = new AbortController();
    setState({ identity, history: null, message: "Loading account history…" });
    void (async () => {
      try {
        if (!address) throw new Error("Connect your wallet to view account returns.");
        const endpoint = process.env.NEXT_PUBLIC_ACCOUNT_HISTORY_URL;
        if (!endpoint) throw new Error("Account valuation and cash-flow history is unavailable.");
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set("account", address);
        if (chainId) url.searchParams.set("chainId", String(chainId));
        const response = await fetch(url, { signal: controller.signal, headers: { Authorization: "Bearer " + getAccessToken() } });
        if (!response.ok) throw new Error("Account history unavailable (" + response.status + ").");
        const history: AccountHistory = await response.json();
        if (!history || !Array.isArray(history.values) || !Array.isArray(history.cashFlows) || history.values.some((v) => !v || !Number.isFinite(v.timestamp) || !Number.isFinite(v.value) || v.value < 0) || history.cashFlows.some((f) => !f || !Number.isFinite(f.timestamp) || !Number.isFinite(f.amount))) throw new Error("Invalid account history response.");
        if (!controller.signal.aborted) setState({ identity, history, message: "" });
      } catch (error) {
        if (!controller.signal.aborted) setState({ identity, history: null, message: error instanceof Error ? error.message : "Account history unavailable." });
      }
    })();
    return () => controller.abort();
  }, [identity, address, chainId, suppliedHistory]);
  const history = suppliedHistory ?? (state.identity === identity ? state.history : null);
  const result = useMemo(() => {
    if (!history || history.cashFlowsComplete !== true) return null;
    const now = Date.now();
    const start = period === "ALL" ? 0 : period === "1W" ? subWeeks(now, 1).getTime() : subMonths(now, period === "1M" ? 1 : period === "3M" ? 3 : 12).getTime();
    const values = history.values.filter((v) => v.timestamp >= start && v.timestamp <= now).sort((a, b) => a.timestamp - b.timestamp);
    const twr = calculateTWR(values, history.cashFlows);
    if (twr === null) return null;
    const chart = values.map((v, index) => ({ timestamp: v.timestamp, return: index === 0 ? 0 : calculateTWR(values.slice(0, index + 1), history.cashFlows) }));
    return { twr, chart, from: values[0].timestamp, to: values[values.length - 1].timestamp };
  }, [history, period]);
  return (
    <section className="space-y-4 rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex justify-between flex-wrap gap-3">
        <h2 className="font-semibold">Time-Weighted Return (TWR)</h2>
        <div className="flex gap-2">{PERIODS.map((p) => <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} className="text-xs border rounded px-2 py-1">{p}</button>)}</div>
      </div>
      {!result ? <p role="status">{history ? "Insufficient history: returns require at least two valuations, complete cash flows, and a valuation at every deposit or withdrawal." : state.identity === identity ? state.message : "Loading account history…"}</p> : (
        <>
          <p className="text-3xl font-bold">{result.twr >= 0 ? "+" : ""}{result.twr.toFixed(2)}%</p>
          <p className="text-xs">Available history: {format(result.from, "MMM d, yyyy HH:mm")} – {format(result.to, "MMM d, yyyy HH:mm")}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={result.chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v) => format(v, "MMM d")} />
              <YAxis tickFormatter={(v) => v.toFixed(0) + "%"} />
              <Tooltip labelFormatter={(v) => format(Number(v), "MMM d, yyyy HH:mm")} formatter={(v) => [Number(v).toFixed(2) + "%", "TWR"]} />
              <Line type="linear" dataKey="return" stroke="#22c55e" dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}
