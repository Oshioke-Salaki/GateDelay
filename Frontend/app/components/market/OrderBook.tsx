"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import PriceDisplay from "./PriceDisplay";

interface Order {
  price: number;
  quantity: number;
  user?: string;
}

interface OrderBookProps {
  marketId: string;
  userAddress?: string;
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
// Custom tooltip uses CSS variables so it adapts to light and dark mode.
// recharts' default tooltip renders a white card which becomes invisible on
// dark backgrounds (--background: #0a0a0a).

interface TooltipPayload {
  payload?: {
    price: number;
    cumulative: number;
    quantity: number;
    type: string;
  };
}

function DepthTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: d.type === "bid" ? "#22c55e" : "#ef4444" }}>
        {d.type === "bid" ? "Bid" : "Ask"} @ ${d.price.toFixed(4)}
      </p>
      <p style={{ color: "var(--muted)" }}>
        Size:{" "}
        <span style={{ color: "var(--foreground)" }}>{d.quantity}</span>
      </p>
      <p style={{ color: "var(--muted)" }}>
        Cumulative:{" "}
        <span style={{ color: "var(--foreground)" }}>{d.cumulative}</span>
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrderBook({ marketId, userAddress }: OrderBookProps) {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);
  const { price: _price, isConnected } = useSinglePriceUpdate(marketId);

  useEffect(() => {
    const mockBids: Order[] = [
      { price: 0.95, quantity: 100, user: "0x123" },
      { price: 0.94, quantity: 200, user: "0x456" },
      { price: 0.93, quantity: 150 },
      { price: 0.92, quantity: 50 },
    ];
    const mockAsks: Order[] = [
      { price: 1.05, quantity: 120 },
      { price: 1.06, quantity: 80, user: "0x789" },
      { price: 1.07, quantity: 90 },
      { price: 1.08, quantity: 60 },
    ];
    setBids(mockBids);
    setAsks(mockAsks);
  }, [marketId]);

  const depthData = useMemo(() => {
    const bidDepth = [...bids]
      .sort((a, b) => b.price - a.price)
      .reduce(
        (acc, order, index) => {
          const cumulative = (acc[index - 1]?.cumulative ?? 0) + order.quantity;
          acc.push({ price: order.price, quantity: order.quantity, cumulative, type: "bid" });
          return acc;
        },
        [] as { price: number; quantity: number; cumulative: number; type: string }[],
      );

    const askDepth = [...asks]
      .sort((a, b) => a.price - b.price)
      .reduce(
        (acc, order, index) => {
          const cumulative = (acc[index - 1]?.cumulative ?? 0) + order.quantity;
          acc.push({ price: order.price, quantity: order.quantity, cumulative, type: "ask" });
          return acc;
        },
        [] as { price: number; quantity: number; cumulative: number; type: string }[],
      );

    return [...bidDepth.reverse(), ...askDepth];
  }, [bids, asks]);

  const maxQuantity = Math.max(
    ...bids.map((b) => b.quantity),
    ...asks.map((a) => a.quantity),
    1, // guard against empty arrays
  );

  // ─── Order table ────────────────────────────────────────────────────────────

  const renderOrderTable = (orders: Order[], isBid: boolean) => (
    <div className="flex-1 min-w-0">
      <h3
        className="text-base font-semibold mb-2"
        style={{ color: isBid ? "#22c55e" : "#ef4444" }}
      >
        {isBid ? "Bids (Buy)" : "Asks (Sell)"}
      </h3>

      {/* Column headers */}
      <div
        className="grid gap-x-2 px-2 py-1 text-xs font-semibold rounded-t"
        style={{
          gridTemplateColumns: "1fr 1fr auto",
          background: "var(--background)",
          color: "var(--muted)",
          border: "1px solid var(--border)",
          borderBottom: "none",
        }}
      >
        <span>Price</span>
        <span className="text-right">Qty</span>
        <span className="w-16" aria-hidden="true" />
      </div>

      <div
        className="space-y-px max-h-64 overflow-y-auto rounded-b"
        style={{ border: "1px solid var(--border)" }}
      >
        {orders.map((order, index) => {
          const isOwn = order.user === userAddress;
          return (
            <div
              key={index}
              className="grid items-center gap-x-2 px-2 py-1.5 relative"
              style={{
                gridTemplateColumns: "1fr 1fr auto",
                background: isOwn ? "rgba(59,130,246,.12)" : "var(--card)",
                outline: isOwn ? "1px solid rgba(59,130,246,.4)" : "none",
              }}
            >
              {/* Price */}
              <span
                className="font-mono tabular-nums text-xs font-medium"
                style={{ color: isBid ? "#22c55e" : "#ef4444" }}
              >
                {order.price.toFixed(4)}
              </span>

              {/* Quantity */}
              <span
                className="font-mono tabular-nums text-xs text-right"
                style={{ color: "var(--foreground)" }}
              >
                {order.quantity}
              </span>

              {/* Depth bar */}
              <div
                className="w-16 rounded-full overflow-hidden"
                style={{ height: "6px", background: "var(--border)" }}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(order.quantity / maxQuantity) * 100}%`,
                    background: isBid ? "#22c55e" : "#ef4444",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="p-4 rounded-lg shadow"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          Order Book
        </h2>
        <div className="flex items-center gap-2">
          <PriceDisplay marketId={marketId} size="md" showChange showVolume />
          {!isConnected && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                color: "#92400e",
                background: "#fef3c7",
                border: "1px solid #fde68a",
              }}
            >
              Offline Mode
            </span>
          )}
        </div>
      </div>

      {/* Bid / Ask tables side by side */}
      <div className="flex gap-4 mb-4 overflow-x-auto">
        {renderOrderTable(
          [...bids].sort((a, b) => b.price - a.price),
          true,
        )}
        {renderOrderTable(
          [...asks].sort((a, b) => a.price - b.price),
          false,
        )}
      </div>

      {/* Depth chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={depthData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="price"
              tickFormatter={(v: number) => v.toFixed(2)}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              content={<DepthTooltip />}
              cursor={{ fill: "var(--border)", opacity: 0.5 }}
            />
            <Bar dataKey="cumulative" radius={[2, 2, 0, 0]}>
              {depthData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.type === "bid" ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
