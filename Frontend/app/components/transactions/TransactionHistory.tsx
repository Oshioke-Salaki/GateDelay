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
import { format, isWithinInterval, parseISO } from "date-fns";

export type TransactionType = "buy" | "sell" | "redeem" | "deposit" | "withdraw";
export type TransactionStatus = "confirmed" | "pending" | "failed";

export interface Transaction {
  id: string;
  date: string; // ISO string
  type: TransactionType;
  market: string;
  amount: number;
  status: TransactionStatus;
  txHash: string;
}

// ── mock data (replace with real API fetch) ──────────────────────────────────
const MOCK_TRANSACTIONS: Transaction[] = Array.from({ length: 47 }, (_, i) => {
  const types: TransactionType[] = ["buy", "sell", "redeem", "deposit", "withdraw"];
  const statuses: TransactionStatus[] = ["confirmed", "pending", "failed"];
  const markets = ["AA123 on-time?", "UA456 delay >30m?", "DL789 cancelled?", "SW101 on-time?"];
  const d = new Date(2026, 3, 23 - (i % 30));
  return {
    id: `tx-${i + 1}`,
    date: d.toISOString(),
    type: types[i % types.length],
    market: markets[i % markets.length],
    amount: parseFloat((Math.random() * 500 + 5).toFixed(2)),
    status: statuses[i % statuses.length],
    txHash: `0x${Math.random().toString(16).slice(2, 10)}…`,
  };
});

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<TransactionStatus, { bg: string; color: string }> = {
  confirmed: { bg: "#22c55e22", color: "#22c55e" },
  pending:   { bg: "#f59e0b22", color: "#f59e0b" },
  failed:    { bg: "#ef444422", color: "#ef4444" },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy", sell: "Sell", redeem: "Redeem", deposit: "Deposit", withdraw: "Withdraw",
};

function exportCSV(rows: Transaction[]) {
  const header = ["Date", "Type", "Market", "Amount (USDC)", "Status", "Tx Hash"];
  const lines = rows.map((r) => [
    format(parseISO(r.date), "yyyy-MM-dd HH:mm"),
    r.type,
    `"${r.market}"`,
    r.amount.toFixed(2),
    r.status,
    r.txHash,
  ]);
  const csv = [header, ...lines].map((l) => l.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const columnHelper = createColumnHelper<Transaction>();

const COLUMNS = [
  columnHelper.accessor("date", {
    header: "Date",
    cell: (info) => format(parseISO(info.getValue()), "MMM d, yyyy HH:mm"),
    sortingFn: "datetime",
  }),
  columnHelper.accessor("type", {
    header: "Type",
    cell: (info) => (
      <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ background: "var(--border)", color: "var(--foreground)" }}>
        {TYPE_LABELS[info.getValue()]}
      </span>
    ),
  }),
  columnHelper.accessor("market", { header: "Market" }),
  columnHelper.accessor("amount", {
    header: "Amount (USDC)",
    cell: (info) => `$${info.getValue().toFixed(2)}`,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = info.getValue();
      const style = STATUS_STYLES[s];
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{ background: style.bg, color: style.color }}>
          {s}
        </span>
      );
    },
  }),
  columnHelper.accessor("txHash", {
    header: "Tx Hash",
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
        {info.getValue()}
      </span>
    ),
  }),
];

// ── component ─────────────────────────────────────────────────────────────────
interface Props {
  /** Pass real data from an API; falls back to mock data */
  data?: Transaction[];
}

export default function TransactionHistory({ data = MOCK_TRANSACTIONS }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Apply date-range + type filters before handing to the table
  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (dateFrom || dateTo) {
        const d = parseISO(row.date);
        const from = dateFrom ? parseISO(dateFrom) : new Date(0);
        const to = dateTo ? parseISO(dateTo) : new Date(8640000000000000);
        if (!isWithinInterval(d, { start: from, end: to })) return false;
      }
      return true;
    });
  }, [data, typeFilter, dateFrom, dateTo]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const handleExport = useCallback(() => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    exportCSV(rows);
  }, [table]);

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Type filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <option value="all">All types</option>
            {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>

        <button
          onClick={handleExport}
          className="ml-auto rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
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
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No transactions found.
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
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
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
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
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
  );
}
