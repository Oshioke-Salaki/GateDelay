"use client";

import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { ChevronDown, CircleDollarSign, Percent, ShieldCheck } from "lucide-react";

interface TradePreviewProps {
  marketName?: string;
  side?: "YES" | "NO";
  price?: number;
  amount?: number;
  feeRate?: number;
  className?: string;
}

export default function TradePreview({
  marketName = "Sample market",
  side = "YES",
  price = 0.54,
  amount = 100,
  feeRate = 0.02,
  className = "",
}: TradePreviewProps) {
  const [slippage, setSlippage] = useState(0.5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const preview = useMemo(() => {
    const fee = amount * feeRate;
    const total = amount + fee;
    const shares = amount / price;
    const expectedPayout = shares;
    const worstCasePrice = Math.max(0.01, price * (1 - slippage / 100));
    const bestCasePrice = Math.min(0.99, price * (1 + slippage / 200));
    return {
      fee,
      total,
      shares,
      expectedPayout,
      worstCasePrice,
      bestCasePrice,
      netEdge: expectedPayout - total,
    };
  }, [amount, feeRate, price, slippage]);

  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--muted)" }}>
            Trade preview
          </p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Review before execution
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            See the trade details, fees, and expected outcome before submitting.
          </p>
        </div>
        <button onClick={() => setShowAdvanced((s) => !s)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
          Customization
          <ChevronDown size={16} className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Detail label="Market" value={marketName} />
        <Detail label="Side" value={side} accent={side === "YES" ? "#22c55e" : "#ef4444"} />
        <Detail label="Entry price" value={`$${price.toFixed(2)}`} />
        <Detail label="Stake" value={`$${amount.toFixed(2)}`} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Expected shares" value={preview.shares.toFixed(2)} icon={CircleDollarSign} />
        <Metric label="Fees" value={`$${preview.fee.toFixed(2)}`} icon={Percent} />
        <Metric label="Net edge" value={`$${preview.netEdge.toFixed(2)}`} icon={ShieldCheck} accent={preview.netEdge >= 0 ? "#22c55e" : "#ef4444"} />
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--muted)" }}>Outcome estimate</span>
          <span className="font-semibold" style={{ color: preview.netEdge >= 0 ? "#22c55e" : "#ef4444" }}>
            {preview.netEdge >= 0 ? "Favorable" : "Unfavorable"}
          </span>
        </div>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>Best-case price: <span className="font-semibold">${preview.bestCasePrice.toFixed(2)}</span></div>
          <div>Worst-case price: <span className="font-semibold">${preview.worstCasePrice.toFixed(2)}</span></div>
          <div>Estimated payout: <span className="font-semibold">${preview.expectedPayout.toFixed(2)}</span></div>
          <div>Total with fees: <span className="font-semibold">${preview.total.toFixed(2)}</span></div>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <label className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Slippage tolerance: {slippage.toFixed(1)}%
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="mt-3 w-full"
          />
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Adjust the preview to reflect a tighter or wider execution band.
          </p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: accent ?? "var(--foreground)" }}>{value}</div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: string; icon: ComponentType<{ size?: number; className?: string }>; accent?: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <Icon size={14} className={accent ? "" : ""} />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold" style={{ color: accent ?? "var(--foreground)" }}>{value}</div>
    </div>
  );
}
