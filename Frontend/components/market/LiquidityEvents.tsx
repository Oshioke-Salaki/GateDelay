"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export interface LiquidityEvent {
  id: string;
  type: "add" | "remove";
  provider: string;
  amount: number;
  timestamp: Date;
  isLarge?: boolean;
}

export interface LiquidityEventsProps {
  marketId: string;
  className?: string;
}

const LARGE_EVENT_THRESHOLD = 1000;
const MAX_EVENTS = 50;

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function generateMockEvent(date: Date): LiquidityEvent {
  const isAdd = Math.random() > 0.5;
  const isLarge = Math.random() > 0.85;
  const providers = ["0x1234...5678", "0xabcd...ef01", "0x9876...5432", "0xfedc...ba98"];
  return {
    id: Math.random().toString(36).substring(2, 9),
    type: isAdd ? "add" : "remove",
    provider: providers[Math.floor(Math.random() * providers.length)],
    amount: isLarge ? Math.floor(Math.random() * 5000) + 1000 : Math.floor(Math.random() * 900) + 100,
    timestamp: date,
    isLarge,
  };
}

export default function LiquidityEvents({
  marketId,
  className = "",
}: LiquidityEventsProps) {
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "add" | "remove">("all");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialEvents: LiquidityEvent[] = Array.from({ length: 20 }).map((_, i) => {
      const d = new Date();
      d.setSeconds(d.getSeconds() - (20 - i) * 10);
      return generateMockEvent(d);
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setEvents(initialEvents);

    const interval = setInterval(() => {
      const newEvent = generateMockEvent(new Date());
      setEvents((prev) => {
        const updated = [newEvent, ...prev];
        return updated.slice(0, MAX_EVENTS);
      });
    }, Math.random() * 3000 + 2000);

    return () => clearInterval(interval);
  }, [marketId]);

  const filteredEvents = events.filter((event) => {
    const matchesType = filterType === "all" || event.type === filterType;
    const matchesSearch = event.provider.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totalAdded = events
    .filter((e) => e.type === "add")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalRemoved = events
    .filter((e) => e.type === "remove")
    .reduce((sum, e) => sum + e.amount, 0);
  const netLiquidity = totalAdded - totalRemoved;

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col h-full ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="px-4 py-3 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Liquidity Events
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Market #{marketId} · {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: "Added", value: formatAmount(totalAdded), color: "#22c55e" },
            { label: "Removed", value: formatAmount(totalRemoved), color: "#ef4444" },
            { label: "Net", value: formatAmount(netLiquidity), color: "#3b82f6" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border p-2"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <p style={{ color: "var(--muted)" }}>{stat.label}</p>
              <p className="font-semibold mt-1" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search and filter */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search provider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs border"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | "add" | "remove")}
            className="px-3 py-1.5 rounded-lg text-xs border"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All</option>
            <option value="add">Added</option>
            <option value="remove">Removed</option>
          </select>
        </div>
      </div>

      {/* Events list header */}
      <div
        className="flex items-center px-4 py-2 text-xs font-medium sticky top-0 z-10"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}
      >
        <div className="w-20">Time</div>
        <div className="flex-1">Provider</div>
        <div className="w-24 text-right">Amount</div>
      </div>

      {/* Events scroll area */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        {filteredEvents.length === 0 ? (
          <div
            className="flex items-center justify-center h-32 text-xs"
            style={{ color: "var(--muted)" }}
          >
            No events found
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredEvents.map((event) => {
              const isLarge = event.amount >= LARGE_EVENT_THRESHOLD;
              const eventColor = event.type === "add" ? "#22c55e" : "#ef4444";
              const bgColor = event.type === "add" ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)";

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0, y: -10, backgroundColor: bgColor }}
                  animate={{ opacity: 1, height: "auto", y: 0, backgroundColor: "transparent" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center px-4 py-3 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 border-b ${
                    isLarge ? "font-semibold" : ""
                  }`}
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <div className="w-20 whitespace-nowrap text-xs" style={{ color: "var(--muted)" }}>
                    {format(event.timestamp, "HH:mm:ss")}
                  </div>

                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span
                      className="shrink-0 h-2 w-2 rounded-full"
                      style={{ background: eventColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs" style={{ color: "var(--muted)" }}>
                      {event.provider}
                    </span>
                  </div>

                  <div className="w-24 text-right flex items-center justify-end gap-1">
                    {isLarge && (
                      <span title="Large Event" aria-label="Large Event">
                        🔥
                      </span>
                    )}
                    <span style={{ color: eventColor }}>
                      {event.type === "add" ? "+" : "-"}
                      {formatAmount(event.amount)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
