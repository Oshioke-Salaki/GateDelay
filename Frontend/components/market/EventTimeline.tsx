"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketEventType =
  | "CREATION"
  | "TRADE"
  | "LIQUIDITY_ADD"
  | "LIQUIDITY_REMOVE"
  | "RESOLUTION"
  | "DISPUTE"
  | "SETTLEMENT"
  | "PRICE_MILESTONE";

export interface MarketEvent {
  id: string;
  type: MarketEventType;
  timestamp: Date;
  title: string;
  description?: string;
  /** Arbitrary key-value metadata surfaced in the expanded details panel */
  metadata?: Record<string, string | number | boolean>;
  /** Address of the actor (wallet, resolver, etc.) */
  actor?: string;
  /** USD value involved, if applicable */
  valueUsd?: number;
  /** Transaction hash for on-chain events */
  txHash?: string;
  /** Signals if this is a particularly significant event */
  isHighlight?: boolean;
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const EVENT_CONFIG: Record<
  MarketEventType,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  CREATION: {
    label: "Market Created",
    icon: "🏛️",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.35)",
  },
  TRADE: {
    label: "Trade",
    icon: "⚡",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.35)",
  },
  LIQUIDITY_ADD: {
    label: "Liquidity Added",
    icon: "💧",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
  },
  LIQUIDITY_REMOVE: {
    label: "Liquidity Removed",
    icon: "🔻",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
  },
  RESOLUTION: {
    label: "Resolution",
    icon: "✅",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
  },
  DISPUTE: {
    label: "Dispute",
    icon: "⚠️",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
  },
  SETTLEMENT: {
    label: "Settlement",
    icon: "🏆",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.35)",
  },
  PRICE_MILESTONE: {
    label: "Price Milestone",
    icon: "📈",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.35)",
  },
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Mock data generator ───────────────────────────────────────────────────────

function generateMockEvents(count: number): MarketEvent[] {
  const types: MarketEventType[] = [
    "CREATION",
    "TRADE",
    "TRADE",
    "TRADE",
    "LIQUIDITY_ADD",
    "LIQUIDITY_REMOVE",
    "RESOLUTION",
    "DISPUTE",
    "SETTLEMENT",
    "PRICE_MILESTONE",
  ];
  const actors = [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    "0xabcdef1234567890abcdef1234567890abcdef12",
    "0xcafebabecafebabecafebabecafebabecafebabe",
  ];
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => {
    const type = i === 0 ? "CREATION" : types[Math.floor(Math.random() * types.length)];
    const msAgo = (count - i) * (Math.random() * 120_000 + 30_000);
    const isHighlight = Math.random() > 0.85;
    const valueUsd =
      type === "TRADE" || type === "LIQUIDITY_ADD" || type === "LIQUIDITY_REMOVE"
        ? Math.random() * 10_000 + 50
        : undefined;

    const titles: Record<MarketEventType, string> = {
      CREATION: "Market opened for trading",
      TRADE: Math.random() > 0.5 ? "YES position purchased" : "NO position purchased",
      LIQUIDITY_ADD: "Liquidity deposited",
      LIQUIDITY_REMOVE: "Liquidity withdrawn",
      RESOLUTION: "Market resolved",
      DISPUTE: "Resolution challenged",
      SETTLEMENT: "Payouts distributed",
      PRICE_MILESTONE: Math.random() > 0.5 ? "YES crossed 75¢" : "NO crossed 60¢",
    };

    const meta: Record<string, string | number | boolean> = {};
    if (type === "TRADE") {
      meta["Side"] = Math.random() > 0.5 ? "YES" : "NO";
      meta["Price"] = `${(Math.random() * 0.9 + 0.05).toFixed(2)} USDC`;
      meta["Shares"] = Math.floor(Math.random() * 500 + 10);
    }
    if (type === "RESOLUTION" || type === "SETTLEMENT") {
      meta["Outcome"] = Math.random() > 0.5 ? "YES" : "NO";
      meta["Oracle"] = "Chainlink DAPI";
    }
    if (type === "DISPUTE") {
      meta["Bond"] = `${(Math.random() * 500 + 100).toFixed(0)} USDC`;
      meta["Status"] = "Pending";
    }
    if (type === "PRICE_MILESTONE") {
      meta["Previous Price"] = `${(Math.random() * 0.5 + 0.1).toFixed(2)}¢`;
      meta["New Price"] = `${(Math.random() * 0.9 + 0.55).toFixed(2)}¢`;
    }

    return {
      id: `evt-${i}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: new Date(now - msAgo),
      title: titles[type],
      description:
        isHighlight
          ? "This event had a significant impact on market dynamics and participant positions."
          : undefined,
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
      actor: actors[Math.floor(Math.random() * actors.length)],
      valueUsd,
      txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
      isHighlight,
    };
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EventCardProps {
  event: MarketEvent;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: (id: string) => void;
}

function EventCard({ event, isExpanded, isHighlighted, onToggle }: EventCardProps) {
  const cfg = EVENT_CONFIG[event.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative pl-10"
    >
      {/* Timeline dot */}
      <span
        className="absolute left-0 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-sm select-none"
        style={{
          background: cfg.bg,
          border: `1.5px solid ${cfg.border}`,
          zIndex: 1,
        }}
        aria-hidden="true"
      >
        {cfg.icon}
      </span>

      {/* Card */}
      <button
        id={`timeline-event-${event.id}`}
        aria-expanded={isExpanded}
        onClick={() => onToggle(event.id)}
        className="w-full text-left rounded-xl px-4 py-3 transition-all duration-200 hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{
          background: isHighlighted
            ? cfg.bg
            : "var(--card)",
          border: `1px solid ${isHighlighted ? cfg.border : "var(--border)"}`,
          boxShadow: event.isHighlight ? `0 0 0 1px ${cfg.border}` : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Event type badge + highlight indicator */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label}
              </span>
              {event.isHighlight && (
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                >
                  🔥 Notable
                </span>
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
              {event.title}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {formatDistanceToNow(event.timestamp, { addSuffix: true })}
              </span>
              {event.actor && (
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                  {shortenAddress(event.actor)}
                </span>
              )}
              {event.valueUsd !== undefined && (
                <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                  {formatValue(event.valueUsd)}
                </span>
              )}
            </div>
          </div>

          {/* Timestamp + chevron */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
              {format(event.timestamp, "MMM d, HH:mm")}
            </span>
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: "var(--muted)" }}
              aria-hidden="true"
            >
              <polyline points="2,4 7,10 12,4" />
            </motion.svg>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-xl px-4 py-3 space-y-3"
              style={{ background: "var(--background)", border: `1px solid ${cfg.border}` }}
            >
              {/* Description */}
              {event.description && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {event.description}
                </p>
              )}

              {/* Metadata grid */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(event.metadata).map(([key, val]) => (
                    <div
                      key={key}
                      className="rounded-lg px-3 py-2"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>
                        {key}
                      </p>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Full timestamp */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {format(event.timestamp, "PPpp")}
                </span>

                {/* Tx hash link */}
                {event.txHash && (
                  <a
                    href={`https://explorer.mantle.xyz/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    style={{
                      background: "rgba(59,130,246,0.12)",
                      color: "#3b82f6",
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M1 9L9 1M9 1H4M9 1V6" />
                    </svg>
                    View on Explorer
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  icon: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, icon, color, active, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{
        background: active ? `${color}22` : "var(--card)",
        color: active ? color : "var(--muted)",
        border: `1px solid ${active ? `${color}55` : "var(--border)"}`,
      }}
      aria-pressed={active}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface EventTimelineProps {
  marketId: string;
  /** Pass real events here; if omitted, mock data is generated */
  events?: MarketEvent[];
  /** Total event count for pagination (when using real data) */
  totalEvents?: number;
  /** Called when the user navigates to a new page (1-indexed) */
  onPageChange?: (page: number) => void;
  className?: string;
}

export default function EventTimeline({
  marketId,
  events: externalEvents,
  totalEvents: externalTotal,
  onPageChange,
  className = "",
}: EventTimelineProps) {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [mockEvents] = useState<MarketEvent[]>(() =>
    externalEvents ? [] : generateMockEvents(120)
  );
  const allEvents: MarketEvent[] = externalEvents ?? mockEvents;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<MarketEventType>>(new Set());
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, highlightOnly, search]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...allEvents];

    // Sort chronologically (newest first already, but ensure order)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (activeFilters.size > 0) {
      result = result.filter((e) => activeFilters.has(e.type));
    }
    if (highlightOnly) {
      result = result.filter((e) => e.isHighlight);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          (e.actor?.toLowerCase().includes(q) ?? false) ||
          (e.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [allEvents, activeFilters, highlightOnly, search]);

  const totalCount = externalTotal ?? filtered.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEvents = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFilter = useCallback((type: MarketEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [onPageChange]
  );

  const expandAll = () => setExpandedIds(new Set(pageEvents.map((e) => e.id)));
  const collapseAll = () => setExpandedIds(new Set());

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      ref={containerRef}
      aria-label="Market Event Timeline"
      className={`w-full space-y-4 ${className}`}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Event Timeline
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {totalCount.toLocaleString()} event{totalCount !== 1 ? "s" : ""} · Market #{marketId}
          </p>
        </div>

        {/* Expand / Collapse controls */}
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl p-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {(
          [
            ["CREATION", "Markets Started"],
            ["TRADE", "Trades"],
            ["RESOLUTION", "Resolutions"],
            ["DISPUTE", "Disputes"],
          ] as [MarketEventType, string][]
        ).map(([type, label]) => {
          const cfg = EVENT_CONFIG[type];
          const count = allEvents.filter((e) => e.type === type).length;
          return (
            <div key={type} className="text-center">
              <p className="text-lg font-bold" style={{ color: cfg.color }}>
                {count}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--muted)" }}
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="5" />
          <line x1="11" y1="11" x2="15" y2="15" />
        </svg>
        <input
          id={`timeline-search-${marketId}`}
          type="search"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
          aria-label="Search timeline events"
        />
      </div>

      {/* ── Filter pills ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EVENT_CONFIG) as MarketEventType[]).map((type) => {
          const cfg = EVENT_CONFIG[type];
          return (
            <FilterPill
              key={type}
              label={cfg.label}
              icon={cfg.icon}
              color={cfg.color}
              active={activeFilters.has(type)}
              onClick={() => toggleFilter(type)}
            />
          );
        })}
        <FilterPill
          label="Notable Only"
          icon="🔥"
          color="#f59e0b"
          active={highlightOnly}
          onClick={() => setHighlightOnly((v) => !v)}
        />
        {(activeFilters.size > 0 || highlightOnly || search) && (
          <button
            onClick={() => {
              setActiveFilters(new Set());
              setHighlightOnly(false);
              setSearch("");
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {pageEvents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl select-none" aria-hidden="true">
              🔍
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              No events match your filters
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Try adjusting your search or removing active filters.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {/* Vertical spine */}
            <div className="relative">
              {/* The continuous vertical line */}
              <div
                className="absolute left-3 top-3 bottom-0 w-px"
                style={{ background: "var(--border)" }}
                aria-hidden="true"
              />

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {pageEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isExpanded={expandedIds.has(event.id)}
                      isHighlighted={activeFilters.has(event.type)}
                      onToggle={toggleExpand}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Timeline pagination"
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Page {currentPage} of {totalPages} · showing {pageEvents.length} of{" "}
            {filtered.length} events
          </p>

          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              aria-label="Previous page"
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{
                background: "var(--card)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              ← Prev
            </button>

            {/* Page numbers — show up to 5 around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - currentPage) <= 2
              )
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-xs"
                    style={{ color: "var(--muted)" }}
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p as number)}
                    aria-label={`Page ${p}`}
                    aria-current={currentPage === p ? "page" : undefined}
                    className="h-7 w-7 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    style={{
                      background:
                        currentPage === p ? "#3b82f6" : "var(--card)",
                      color: currentPage === p ? "#fff" : "var(--foreground)",
                      border: `1px solid ${currentPage === p ? "#3b82f6" : "var(--border)"}`,
                    }}
                  >
                    {p}
                  </button>
                )
              )}

            {/* Next */}
            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              aria-label="Next page"
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{
                background: "var(--card)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
