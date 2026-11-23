"use client";

import { useState, useMemo, useCallback, useId, useEffect } from "react";
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
import { useAccount } from "wagmi";
import { getAccessToken } from "@/lib/portfolioApi";
import { resolveApiBase } from "@/lib/apiBase";
import { explorerTxUrl, truncateTxHash } from "@/lib/txUtils";
import { format, isWithinInterval, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TransactionStatus, { bg: string; color: string }> = {
  confirmed: { bg: "#22c55e22", color: "#22c55e" },
  pending:   { bg: "#f59e0b22", color: "#f59e0b" },
  failed:    { bg: "#ef444422", color: "#ef4444" },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  redeem: "Redeem",
  deposit: "Deposit",
  withdraw: "Withdraw",
};

function exportCSV(rows: Transaction[]) {
  const header = ["Date", "Type", "Market", "Amount (USDC)", "Status", "Tx Hash"];
  const lines = rows.map((r) => [
    format(parseISO(r.date), "yyyy-MM-dd HH:mm"),
    r.type,
    r.market,
    r.amount.toFixed(2),
    r.status,
    r.txHash,
  ]);
  const csv = [header, ...lines].map((l) => l.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Column definitions ────────────────────────────────────────────────────────

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
      <span
        className="capitalize text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ background: "var(--border)", color: "var(--foreground)" }}
      >
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
      const s     = info.getValue();
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
  columnHelper.accessor("txHash", {
    header: "Tx Hash",
    enableSorting: false,
    cell: (info) => (
      /^(0x)[a-fA-F0-9]{64}$/.test(info.getValue()) ? (
        <a className="font-mono text-xs" href={explorerTxUrl(info.getValue())} title={info.getValue()} target="_blank" rel="noopener noreferrer">{truncateTxHash(info.getValue())}</a>
      ) : <span>Unavailable</span>
    ),
  }),
];

// ── Pagination button helper ──────────────────────────────────────────────────

function PaginationBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Optional caller-provided transaction records. */
  data?: Transaction[];
}

export default function TransactionHistory({ data: suppliedData }: Props) {
  const { address, chainId } = useAccount();
  const identity = address ? address.toLowerCase() + ":" + chainId : "";
  const [history, setHistory] = useState<{ identity: string; data: Transaction[]; message: string }>({ identity: "", data: [], message: "Loading transactions…" });
  useEffect(() => {
    if (suppliedData !== undefined) return;
    const controller = new AbortController();
    setHistory({ identity, data: [], message: address ? "Loading transactions…" : "Connect your wallet to view transactions." });
    if (!address) return () => controller.abort();
    void (async () => {
      try {
        const token = getAccessToken();
        const records: Transaction[] = [];
        let offset = 0;
        while (true) {
          const response = await fetch(resolveApiBase() + "/trading-history?limit=100&offset=" + offset + "&sortBy=date&sortOrder=desc", { signal: controller.signal, headers: { Authorization: "Bearer " + token } });
          if (!response.ok) throw new Error("Transaction history unavailable (" + response.status + ").");
          const body = await response.json();
          if (!Array.isArray(body.data) || !Number.isInteger(body.total) || body.total < 0) throw new Error("Invalid transaction history response.");
          for (const row of body.data) {
            if (!row || typeof row !== "object") throw new Error("Invalid transaction record.");
            const date = new Date(row.createdAt);
            if (!row || !Number.isFinite(date.getTime()) || !Object.prototype.hasOwnProperty.call(TYPE_LABELS, row.type) || !Object.prototype.hasOwnProperty.call(STATUS_STYLES, row.status) || !Number.isFinite(row.amount)) throw new Error("Invalid transaction record.");
            records.push({ id: String(row.id), date: date.toISOString(), type: row.type, market: row.marketId || "—", amount: row.amount, status: row.status, txHash: typeof row.txHash === "string" ? row.txHash : "" });
          }
          offset += body.data.length;
          if (offset >= body.total) break;
          if (body.data.length === 0) throw new Error("Transaction history is incomplete.");
        }
        if (!controller.signal.aborted) setHistory({ identity, data: records, message: records.length ? "Authenticated account transaction history." : "No transactions found for your signed-in account." });
      } catch (error) {
        if (!controller.signal.aborted) setHistory({ identity, data: [], message: error instanceof Error ? error.message : "Transaction history unavailable." });
      }
    })();
    return () => controller.abort();
  }, [identity, address, suppliedData]);
  const data = suppliedData ?? (history.identity === identity ? history.data : []);
  const tableId = useId(); // stable id for aria-labelledby

  const [sorting, setSorting]             = useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [typeFilter, setTypeFilter]       = useState<string>("all");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [pageJump, setPageJump]           = useState("");

  // Apply date-range + type filters before handing to the table
  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (dateFrom || dateTo) {
        const d    = parseISO(row.date);
        const from = dateFrom ? parseISO(dateFrom) : new Date(0);
        const to   = dateTo   ? parseISO(dateTo)   : new Date(8640000000000000);
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
    exportCSV(table.getFilteredRowModel().rows.map((r) => r.original));
  }, [table]);

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount               = table.getPageCount();

  // Derived range string: "1–10 of 47"
  const visibleRows  = table.getRowModel().rows;
  const rangeStart   = filtered.length === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd     = Math.min(pageIndex * pageSize + pageSize, filtered.length);
  const rangeLabel   = filtered.length === 0
    ? "No transactions"
    : `${rangeStart}–${rangeEnd} of ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}`;

  // Page-jump submit
  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageJump, 10);
    if (!isNaN(n) && n >= 1 && n <= pageCount) {
      table.setPageIndex(n - 1);
    }
    setPageJump("");
  };

  // aria-sort value for TanStack column sort state
  const ariaSort = (id: string): React.AriaAttributes["aria-sort"] => {
    const col = sorting.find((s) => s.id === id);
    if (!col) return "none";
    return col.desc ? "descending" : "ascending";
  };

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Filter transactions"
        className="flex flex-wrap items-end gap-3"
      >
        {/* Type filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="txh-type"
            className="text-xs"
            style={{ color: "var(--muted)" }}
          >
            Type
          </label>
          <select
            id="txh-type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); table.setPageIndex(0); }}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">All types</option>
            {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="txh-from"
            className="text-xs"
            style={{ color: "var(--muted)" }}
          >
            From
          </label>
          <input
            id="txh-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); table.setPageIndex(0); }}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="txh-to"
            className="text-xs"
            style={{ color: "var(--muted)" }}
          >
            To
          </label>
          <input
            id="txh-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); table.setPageIndex(0); }}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        <button
          onClick={handleExport}
          className="ml-auto rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          aria-label="Export visible transactions as CSV"
        >
          ↓ Export CSV
        </button>
      </div>

      {suppliedData === undefined && <p className="text-xs" role="status">{history.identity === identity ? history.message : "Loading transactions…"}</p>}

      {/* ── Row-count summary (live region so screen readers announce filter changes) */}
      <p
        id={`${tableId}-summary`}
        aria-live="polite"
        aria-atomic="true"
        className="text-xs"
        style={{ color: "var(--muted)" }}
      >
        {rangeLabel}{pageCount > 1 ? ` · page ${pageIndex + 1} of ${pageCount}` : ""}
      </p>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: "1px solid var(--border)" }}
      >
        <table
          className="w-full text-sm"
          aria-labelledby={`${tableId}-summary`}
          aria-rowcount={filtered.length}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              >
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? ariaSort(header.column.id) : undefined}
                      className="px-4 py-3 text-left text-xs font-semibold select-none"
                      style={{
                        color: "var(--muted)",
                        cursor: canSort ? "pointer" : "default",
                        whiteSpace: "nowrap",
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (canSort && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          header.column.getToggleSortingHandler()?.(e);
                        }
                      }}
                      tabIndex={canSort ? 0 : undefined}
                      role={canSort ? "button" : undefined}
                      title={
                        canSort
                          ? `Sort by ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id}`
                          : undefined
                      }
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {canSort && (
                        <span className="ml-1 opacity-60" aria-hidden="true">
                          {({ asc: "↑", desc: "↓" } as Record<string, string>)[
                            header.column.getIsSorted() as string
                          ] ?? "↕"}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  {suppliedData !== undefined ? "No transactions found." : history.identity === identity ? history.message : "Loading transactions…"}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderTop: "1px solid var(--border)" }}
                  className="transition-colors hover:bg-[var(--card)]"
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

      {/* ── Pagination controls ───────────────────────────────────────────── */}
      <nav
        aria-label="Transaction history pagination"
        className="flex items-center justify-between gap-3 flex-wrap text-sm"
      >
        {/* Left: count (visible on wider screens, hidden at very small) */}
        <span className="hidden sm:block text-xs" style={{ color: "var(--muted)" }}>
          {rangeLabel}
        </span>

        {/* Centre: prev/next group */}
        <div className="flex items-center gap-2 flex-wrap">
          <PaginationBtn
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            label="First page"
          >
            «
          </PaginationBtn>

          <PaginationBtn
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            label="Previous page"
          >
            ‹ Prev
          </PaginationBtn>

          {/* Current page indicator */}
          <span
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              background: "#3b82f620",
              border: "1px solid #3b82f640",
              color: "var(--foreground)",
            }}
            aria-current="page"
            aria-label={`Page ${pageIndex + 1} of ${pageCount || 1}`}
          >
            {pageIndex + 1} / {pageCount || 1}
          </span>

          <PaginationBtn
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            label="Next page"
          >
            Next ›
          </PaginationBtn>

          <PaginationBtn
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            label="Last page"
          >
            »
          </PaginationBtn>
        </div>

        {/* Right: page-jump + page-size */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page jump */}
          {pageCount > 1 && (
            <form
              onSubmit={handlePageJump}
              className="flex items-center gap-1"
              aria-label="Jump to page"
            >
              <label
                htmlFor="txh-jump"
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                Go to
              </label>
              <input
                id="txh-jump"
                type="number"
                min={1}
                max={pageCount}
                value={pageJump}
                onChange={(e) => setPageJump(e.target.value)}
                placeholder="page"
                aria-label={`Jump to page (1–${pageCount})`}
                className="w-16 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
                aria-label="Go to entered page number"
              >
                Go
              </button>
            </form>
          )}

          {/* Page size */}
          <div className="flex items-center gap-1">
            <label
              htmlFor="txh-pagesize"
              className="text-xs"
              style={{ color: "var(--muted)" }}
            >
              Show
            </label>
            <select
              id="txh-pagesize"
              value={pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
                table.setPageIndex(0);
              }}
              aria-label="Rows per page"
              className="rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              {[10, 20, 50].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </nav>
    </div>
  );
}
