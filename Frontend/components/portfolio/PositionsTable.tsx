"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PositionSide = "YES" | "NO";
export type PositionStatus = "open" | "closed";

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  market: string; // human-readable market name
  side: PositionSide;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  maxLoss: number;
  status: PositionStatus;
  openedAt: string; // ISO string
  closedAt?: string;
}

// ── Mock data (replace with real API fetch) ───────────────────────────────────

const MOCK_POSITIONS: Position[] = Array.from({ length: 18 }, (_, i) => {
  const sides: PositionSide[] = ["YES", "NO"];
  const statuses: PositionStatus[] = ["open", "open", "open", "closed"];
  const markets = [
    "AA123 on-time?",
    "UA456 delay >30m?",
    "DL789 cancelled?",
    "SW101 on-time?",
    "BA202 diverted?",
  ];
  const entryPrice = parseFloat((Math.random() * 0.7 + 0.1).toFixed(4));
  const currentPrice = parseFloat((Math.random() * 0.7 + 0.1).toFixed(4));
  const shares = parseFloat((Math.random() * 200 + 10).toFixed(2));
  const costBasis = parseFloat((entryPrice * shares).toFixed(2));
  const pnl = parseFloat(((currentPrice - entryPrice) * shares).toFixed(2));
  const pnlPct = parseFloat(((pnl / costBasis) * 100).toFixed(2));
  const openedAt = new Date(2026, 3, 1 + (i % 26)).toISOString();
  const status = statuses[i % statuses.length];
  return {
    id: `pos-${i + 1}`,
    userId: "user-1",
    marketId: `market-${(i % 5) + 1}`,
    market: markets[i % markets.length],
    side: sides[i % sides.length],
    shares,
    entryPrice,
    currentPrice,
    costBasis,
    pnl,
    pnlPct,
    maxLoss: costBasis,
    status,
    openedAt,
    closedAt: status === "closed" ? new Date(2026, 3, 10 + (i % 15)).toISOString() : undefined,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIDE_STYLES: Record<PositionSide, { bg: string; color: string }> = {
  YES: { bg: "#22c55e22", color: "#22c55e" },
  NO:  { bg: "#ef444422", color: "#ef4444" },
};

const STATUS_STYLES: Record<PositionStatus, { bg: string; color: string }> = {
  open:   { bg: "#3b82f622", color: "#3b82f6" },
  closed: { bg: "#71717a22", color: "#71717a" },
};

function pnlColor(value: number): string {
  if (value > 0) return "#22c55e";
  if (value < 0) return "#ef4444";
  return "var(--muted)";
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

// ── Close confirmation modal ──────────────────────────────────────────────────

interface CloseModalProps {
  position: Position;
  onConfirm: (id: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function CloseModal({ position, onConfirm, onCancel, loading }: CloseModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          Close Position
        </h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Close your <strong style={{ color: "var(--foreground)" }}>{position.side}</strong> position
          on <strong style={{ color: "var(--foreground)" }}>{position.market}</strong>?
        </p>
        <div
          className="rounded-xl p-3 space-y-1 text-sm"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Shares</span>
            <span style={{ color: "var(--foreground)" }}>{fmt(position.shares)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Current price</span>
            <span style={{ color: "var(--foreground)" }}>${fmt(position.currentPrice, 4)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--muted)" }}>Est. value</span>
            <span style={{ color: "var(--foreground)" }}>
              ${fmt(position.currentPrice * position.shares)}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span style={{ color: "var(--muted)" }}>Unrealised P&amp;L</span>
            <span style={{ color: pnlColor(position.pnl) }}>
              {position.pnl >= 0 ? "+" : ""}${fmt(position.pnl)} ({position.pnl >= 0 ? "+" : ""}{fmt(position.pnlPct)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(position.id)}
            disabled={loading}
            className="flex-1 rounded-xl py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "#ef4444", color: "#fff", border: "none" }}
          >
            {loading ? "Closing…" : "Close Position"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Position>();

function buildColumns(onClose: (pos: Position) => void) {
  return [
    columnHelper.accessor("market", {
      header: "Market",
      cell: (info) => (
        <span className="font-medium" style={{ color: "var(--foreground)" }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("side", {
      header: "Outcome",
      cell: (info) => {
        const s = info.getValue();
        const style = SIDE_STYLES[s];
        return (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: style.bg, color: style.color }}
          >
            {s}
          </span>
        );
      },
    }),
    columnHelper.accessor("shares", {
      header: "Shares",
      cell: (info) => fmt(info.getValue()),
    }),
    columnHelper.accessor("costBasis", {
      header: "Cost Basis",
      cell: (info) => `$${fmt(info.getValue())}`,
    }),
    columnHelper.accessor("currentPrice", {
      header: "Current Price",
      cell: (info) => `$${fmt(info.getValue(), 4)}`,
    }),
    columnHelper.accessor((row) => row.currentPrice * row.shares, {
      id: "currentValue",
      header: "Value",
      cell: (info) => `$${fmt(info.getValue())}`,
    }),
    columnHelper.accessor("pnl", {
      header: "Unrealised P&L",
      cell: (info) => {
        const v = info.getValue();
        const pct = info.row.original.pnlPct;
        return (
          <span className="font-semibold" style={{ color: pnlColor(v) }}>
            {v >= 0 ? "+" : ""}${fmt(v)}{" "}
            <span className="text-xs font-normal">
              ({v >= 0 ? "+" : ""}{fmt(pct)}%)
            </span>
          </span>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const s = info.getValue();
        const style = STATUS_STYLES[s];
        return (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{ background: style.bg, color: style.color }}
          >
            {s}
          </span>
        );
      },
    }),
    columnHelper.accessor("openedAt", {
      header: "Opened",
      cell: (info) => format(parseISO(info.getValue()), "MMM d, yyyy"),
      sortingFn: "datetime",
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => {
        const pos = info.row.original;
        if (pos.status !== "open") return null;
        return (
          <button
            onClick={() => onClose(pos)}
            className="rounded-lg px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}
          >
            Close
          </button>
        );
      },
    }),
  ];
}

// ── Main component ────────────────────────────────────────────────────────────

export interface PositionsTableProps {
  /** Live positions from API; falls back to mock data */
  data?: Position[];
  /** Called when user confirms closing a position */
  onClosePosition?: (positionId: string, currentPrice: number) => Promise<void>;
}

export default function PositionsTable({
  data = MOCK_POSITIONS,
  onClosePosition,
}: PositionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "openedAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [marketSearch, setMarketSearch] = useState("");
  const [closingPos, setClosingPos] = useState<Position | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  const handleCloseClick = useCallback((pos: Position) => {
    setClosingPos(pos);
  }, []);

  const handleCloseConfirm = useCallback(
    async (id: string) => {
      if (!closingPos) return;
      setCloseLoading(true);
      try {
        await onClosePosition?.(id, closingPos.currentPrice);
      } finally {
        setCloseLoading(false);
        setClosingPos(null);
      }
    },
    [closingPos, onClosePosition],
  );

  const columns = useMemo(() => buildColumns(handleCloseClick), [handleCloseClick]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (sideFilter !== "all" && row.side !== sideFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (marketSearch && !row.market.toLowerCase().includes(marketSearch.toLowerCase())) return false;
      return true;
    });
  }, [data, sideFilter, statusFilter, marketSearch]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  // Summary stats for open positions
  const openPositions = useMemo(() => data.filter((p) => p.status === "open"), [data]);
  const totalValue = useMemo(
    () => openPositions.reduce((sum, p) => sum + p.currentPrice * p.shares, 0),
    [openPositions],
  );
  const totalPnl = useMemo(
    () => openPositions.reduce((sum, p) => sum + p.pnl, 0),
    [openPositions],
  );

  return (
    <>
      {closingPos && (
        <CloseModal
          position={closingPos}
          onConfirm={handleCloseConfirm}
          onCancel={() => setClosingPos(null)}
          loading={closeLoading}
        />
      )}

      <div className="space-y-4">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Open Positions", value: openPositions.length.toString() },
            { label: "Total Value", value: `$${fmt(totalValue)}` },
            {
              label: "Unrealised P&L",
              value: `${totalPnl >= 0 ? "+" : ""}$${fmt(totalPnl)}`,
              color: pnlColor(totalPnl),
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{label}</p>
              <p className="text-lg font-semibold" style={{ color: color ?? "var(--foreground)" }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Market search */}
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Market</label>
            <input
              type="text"
              placeholder="Search market…"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                minWidth: "160px",
              }}
            />
          </div>

          {/* Side filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Outcome</label>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <option value="all">All</option>
              <option value="YES">YES</option>
              <option value="NO">NO</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    No positions found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderTop: "1px solid var(--border)" }}
                    className="transition-colors hover:bg-(--card)"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 whitespace-nowrap"
                        style={{ color: "var(--foreground)" }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
          <span style={{ color: "var(--muted)" }}>
            {filtered.length} position{filtered.length !== 1 ? "s" : ""}
            {" · "}page {pageIndex + 1} of {pageCount || 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              «
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              ‹ Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Next ›
            </button>
            <button
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              »
            </button>
            <select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {[10, 20, 50].map((s) => (
                <option key={s} value={s}>Show {s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
