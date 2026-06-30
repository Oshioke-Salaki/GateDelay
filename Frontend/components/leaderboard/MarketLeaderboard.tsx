"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Flame,
  Medal,
  Crown,
  RefreshCw,
  User,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";
import { useToast } from "@/hooks/useToast";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimeRange = "24h" | "7d" | "30d" | "all";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  address: string;
  displayName?: string;
  pnl: number;
  pnlPct: number;
  volume: number;
  trades: number;
  winRate: number;
  roi: number;
  streak: number;
  avatar?: string;
}

export interface MarketLeaderboardProps {
  /** Address of the currently logged-in user (for highlighting) */
  currentUserId?: string;
  /** Market to show leaderboard for; undefined shows global */
  marketId?: string;
  /** External data source; falls back to mock data */
  data?: LeaderboardEntry[];
  /** Called when user clicks a row */
  onRowClick?: (entry: LeaderboardEntry) => void;
  /** Show mini sparkline / activity chart in each row */
  showSparkline?: boolean;
  /** Max rows before pagination (default 25) */
  pageSize?: number;
}

// ─── Mock data generator ─────────────────────────────────────────────────────

const MOCK_ADDRESSES = [
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B921E6",
  "0xaC3B0f4364E33a90988F7606621A9FcbF6fB4413",
  "0x0a18029876CbaE54F1B456f01F4B21D3F30e8E8B",
  "0x1c5dC5F65A8Ea5fE5a3f4b7E2C8D6F3A2B1c4D6E",
  "0xB2f4F2e8C9b1D7A5E3C6F8A2D4B6C8E0F1A3B5C7",
  "0xD4E6F8A0B2C4D6E8F0A2B4C6D8E0F2A4B6C8D0E2",
  "0xC8E0F2A4B6D8E0F2A4B6D8E0F2A4B6D8E0F2A4B6",
  "0xE2C4A6B8D0F2A4C6E8F0A2B4C6D8E0F2A4C6E8F0A",
];

const MOCK_NAMES = [
  "CryptoWhale",
  "AlphaSeeker",
  "DegenTrader",
  "MarketMaker",
  "YieldFarmer",
  "RiskTaker",
  "TrendRider",
  "LiquidityKing",
  "ArbMaster",
  "SwingTrader",
  "MoonShot",
  "DiamondHands",
  "FastFingers",
  "TheOracle",
  "BlockWhiz",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateMockData(range: TimeRange): LeaderboardEntry[] {
  const now = Date.now();
  let seed = 0;
  switch (range) {
    case "24h":
      seed = Math.floor(now / (1000 * 60 * 60 * 24));
      break;
    case "7d":
      seed = Math.floor(now / (1000 * 60 * 60 * 24 * 7));
      break;
    case "30d":
      seed = Math.floor(now / (1000 * 60 * 60 * 24 * 30));
      break;
    case "all":
      seed = 12345;
      break;
  }

  const rand = seededRandom(seed);

  return MOCK_ADDRESSES.map((address, i) => {
    const name = MOCK_NAMES[i % MOCK_NAMES.length];
    const basePnl = (rand() - 0.3) * 50000;
    const baseVolume = rand() * 200000 + 5000;
    const trades = Math.floor(rand() * 300) + 5;
    const winRate = rand() * 0.6 + 0.2;
    const streak = Math.floor(rand() * 12);
    const roi = basePnl / (baseVolume * 0.1 + 1000);

    return {
      rank: i + 1,
      userId: `user-${i}`,
      address,
      displayName: rand() > 0.4 ? name : undefined,
      pnl: Math.round(basePnl * 100) / 100,
      pnlPct: Math.round((basePnl / (baseVolume * 0.1 + 1000)) * 10000) / 100,
      volume: Math.round(baseVolume * 100) / 100,
      trades,
      winRate: Math.round(winRate * 10000) / 100,
      roi: Math.round(roi * 10000) / 100,
      streak,
    };
  }).sort((a, b) => b.pnl - a.pnl).map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function pnlColor(value: number): string {
  if (value > 0) return "#22c55e";
  if (value < 0) return "#ef4444";
  return "var(--muted)";
}

function pnlIcon(value: number) {
  if (value > 0) return <TrendingUp size={14} />;
  if (value < 0) return <TrendingDown size={14} />;
  return null;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={16} style={{ color: "#fbbf24" }} />;
  if (rank === 2) return <Medal size={14} style={{ color: "#94a3b8" }} />;
  if (rank === 3) return <Medal size={14} style={{ color: "#b45309" }} />;
  return (
    <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
      #{rank}
    </span>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RowHighlightProps {
  isCurrentUser: boolean;
  children: React.ReactNode;
}

function HighlightedRow({ isCurrentUser, children }: RowHighlightProps) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: isCurrentUser ? "#3b82f612" : "transparent",
        borderTop: "1px solid var(--border)",
      }}
      className={isCurrentUser ? "ring-1 ring-inset ring-blue-500/40" : ""}
    >
      {children}
    </motion.tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MarketLeaderboard({
  currentUserId,
  marketId,
  data: externalData,
  onRowClick,
  showSparkline = false,
  pageSize = 25,
}: MarketLeaderboardProps) {
  const toast = useToast();
  const ws = useWebSocketContext();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [sorting, setSorting] = useState<SortingState>([{ id: "pnl", desc: true }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [internalData, setInternalData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const data = externalData ?? internalData;
  const refreshCounterRef = useRef(0);

  // Generate / refresh mock data when time range changes
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const fresh = generateMockData(timeRange);
      if (!externalData) setInternalData(fresh);
      setLastUpdated(new Date());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [timeRange, externalData]);

  // Auto-refresh every 30s when connected
  useEffect(() => {
    if (!autoRefresh || !ws.isConnected || externalData) return;

    const interval = setInterval(() => {
      refreshCounterRef.current += 1;
      const fresh = generateMockData(timeRange);
      setInternalData(fresh);
      setLastUpdated(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, ws.isConnected, timeRange, externalData]);

  // WebSocket: listen for leaderboard updates
  useEffect(() => {
    if (!ws.isConnected) return;

    const unsub = ws.on("leaderboardUpdate", (payload: { marketId?: string; entries: LeaderboardEntry[] }) => {
      if (marketId && payload.marketId && payload.marketId !== marketId) return;
      setInternalData(payload.entries);
      setLastUpdated(new Date());
    });

    return unsub;
  }, [ws.isConnected, marketId]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(
      (entry) =>
        entry.displayName?.toLowerCase().includes(q) ||
        entry.address.toLowerCase().includes(q) ||
        `#${entry.rank}`.includes(q)
    );
  }, [data, searchQuery]);

  const columns = useMemo(() => {
    const helper = createColumnHelper<LeaderboardEntry>();

    return [
      helper.accessor("rank", {
        header: "Rank",
        cell: (info) => <RankBadge rank={info.getValue()} />,
        size: 70,
      }),
      helper.accessor("address", {
        header: "Trader",
        cell: (info) => {
          const entry = info.row.original;
          const isCurrent = currentUserId && entry.userId === currentUserId;
          return (
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: isCurrent ? "#3b82f622" : "var(--border)",
                  color: isCurrent ? "#3b82f6" : "var(--foreground)",
                }}
              >
                {entry.displayName ? entry.displayName.charAt(0).toUpperCase() : <User size={12} />}
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: isCurrent ? "#3b82f6" : "var(--foreground)" }}
                >
                  {entry.displayName ?? truncateAddress(entry.address)}
                </div>
                {!entry.displayName && (
                  <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                    {truncateAddress(entry.address)}
                  </div>
                )}
              </div>
            </div>
          );
        },
      }),
      helper.accessor("pnl", {
        header: "P&L",
        cell: (info) => {
          const v = info.getValue();
          const color = pnlColor(v);
          return (
            <div className="flex items-center gap-1.5">
              <span style={{ color }}>{pnlIcon(v)}</span>
              <span className="text-sm font-semibold" style={{ color }}>
                {v >= 0 ? "+" : ""}{fmtCurrency(v)}
              </span>
            </div>
          );
        },
        sortingFn: "basic",
      }),
      helper.accessor("pnlPct", {
        header: "P&L %",
        cell: (info) => {
          const v = info.getValue();
          const color = pnlColor(v);
          return (
            <span className="text-sm font-semibold" style={{ color }}>
              {v >= 0 ? "+" : ""}{v.toFixed(2)}%
            </span>
          );
        },
        sortingFn: "basic",
      }),
      helper.accessor("roi", {
        header: "ROI",
        cell: (info) => {
          const v = info.getValue();
          const color = pnlColor(v);
          return (
            <span className="text-sm font-semibold" style={{ color }}>
              {v >= 0 ? "+" : ""}{v.toFixed(2)}%
            </span>
          );
        },
        sortingFn: "basic",
      }),
      helper.accessor("volume", {
        header: "Volume",
        cell: (info) => (
          <span className="text-sm" style={{ color: "var(--foreground)" }}>
            {fmtCurrency(info.getValue())}
          </span>
        ),
        sortingFn: "basic",
      }),
      helper.accessor("trades", {
        header: "Trades",
        cell: (info) => (
          <div className="flex items-center gap-1.5">
            <Activity size={12} style={{ color: "var(--muted)" }} />
            <span className="text-sm" style={{ color: "var(--foreground)" }}>
              {info.getValue()}
            </span>
          </div>
        ),
        sortingFn: "basic",
      }),
      helper.accessor("winRate", {
        header: "Win Rate",
        cell: (info) => {
          const v = info.getValue();
          const color = v >= 0.5 ? "#22c55e" : v >= 0.35 ? "#f59e0b" : "#ef4444";
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)", maxWidth: 60 }}>
                <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color }} />
              </div>
              <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{v.toFixed(1)}%</span>
            </div>
          );
        },
        sortingFn: "basic",
      }),
      helper.accessor("streak", {
        header: "Streak",
        cell: (info) => {
          const v = info.getValue();
          if (v === 0) return <span style={{ color: "var(--muted)" }}>—</span>;
          return (
            <div className="flex items-center gap-1">
              <Flame size={12} style={{ color: "#f59e0b" }} />
              <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>{v}</span>
            </div>
          );
        },
        sortingFn: "basic",
      }),
    ];
  }, [currentUserId]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: curPageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const fresh = generateMockData(timeRange);
      if (!externalData) setInternalData(fresh);
      setLastUpdated(new Date());
      setLoading(false);
      toast.info("Leaderboard Updated", "Rankings refreshed");
    }, 400);
  }, [timeRange, externalData, toast]);

  const handleCopyAddress = useCallback((address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Copied", "Address copied to clipboard");
  }, [toast]);

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "24h", label: "24h" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
    { value: "all", label: "All-time" },
  ];

  // Determine current user's rank for the position indicator
  const currentUserEntry = useMemo(
    () => data.find((entry) => currentUserId && entry.userId === currentUserId),
    [data, currentUserId]
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="p-5 flex flex-col gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#f59e0b18" }}
            >
              <Trophy size={20} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                {marketId ? "Market Leaderboard" : "Global Leaderboard"}
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Top traders ranked by P&L performance
                {lastUpdated && (
                  <span className="ml-2">
                    · Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUserEntry && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "#3b82f618", border: "1px solid #3b82f644", color: "#3b82f6" }}
              >
                <Target size={12} />
                Your rank: #{currentUserEntry.rank}
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{ background: "var(--border)", color: "var(--foreground)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--muted)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--border)")}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: autoRefresh ? "#22c55e18" : "var(--border)",
                color: autoRefresh ? "#22c55e" : "var(--foreground)",
                border: `1px solid ${autoRefresh ? "#22c55e44" : "var(--border)"}`,
              }}
            >
              <Activity size={12} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center gap-1.5">
            {timeRanges.map((tr) => (
              <button
                key={tr.value}
                type="button"
                onClick={() => setTimeRange(tr.value)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                style={{
                  background: timeRange === tr.value ? "#f59e0b18" : "var(--background)",
                  color: timeRange === tr.value ? "#f59e0b" : "var(--muted)",
                  border: `1px solid ${timeRange === tr.value ? "#f59e0b55" : "var(--border)"}`,
                }}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name or address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-3 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Current user position */}
        {currentUserEntry && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl flex items-center justify-between"
            style={{ background: "#3b82f612", border: "1px solid #3b82f633" }}
          >
            <div className="flex items-center gap-3">
              <Target size={16} style={{ color: "#3b82f6" }} />
              <span className="text-sm font-medium" style={{ color: "#3b82f6" }}>
                You are ranked #{currentUserEntry.rank} with {fmtCurrency(currentUserEntry.pnl)} P&L
              </span>
            </div>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {currentUserEntry.trades} trades · {currentUserEntry.winRate.toFixed(1)}% win rate
            </span>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg animate-pulse"
                style={{ background: "var(--border)" }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy size={32} style={{ color: "var(--muted)" }} className="mb-3 opacity-40" />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No traders match your search.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
                    >
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-semibold select-none"
                          style={{
                            color: "var(--muted)",
                            cursor: header.column.getCanSort() ? "pointer" : "default",
                            whiteSpace: "nowrap",
                          }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="ml-1 opacity-60">
                              {{ asc: "↑", desc: "↓" }[header.column.getIsSorted() as string] ?? "↕"}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => {
                    const entry = row.original;
                    const isCurrent = currentUserId ? entry.userId === currentUserId : false;
                    return (
                      <motion.tr
                        key={row.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          background: isCurrent ? "#3b82f612" : "transparent",
                          borderTop: "1px solid var(--border)",
                        }}
                        className={`group transition-colors ${isCurrent ? "ring-1 ring-inset ring-blue-500/40" : ""}`}
                        onClick={() => onRowClick?.(entry)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-3 whitespace-nowrap"
                            style={{ color: "var(--foreground)" }}
                          >
                            {cell.column.id === "address" ? (
                              <div className="flex items-center gap-2">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyAddress(entry.address);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer"
                                  style={{ color: "var(--muted)" }}
                                  aria-label="Copy address"
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                            ) : (
                              flexRender(cell.column.columnDef.cell, cell.getContext())
                            )}
                          </td>
                        ))}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-sm mt-3">
              <span style={{ color: "var(--muted)" }}>
                {filtered.length} trader{filtered.length !== 1 ? "s" : ""}
                {" · "}page {pageIndex + 1} of {pageCount || 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  «
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  ‹ Prev
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  Next ›
                </button>
                <button
                  onClick={() => table.setPageIndex(pageCount - 1)}
                  disabled={!table.getCanNextPage()}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  »
                </button>
                <select
                  value={curPageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {[10, 25, 50].map((s) => (
                    <option key={s} value={s}>Show {s}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
