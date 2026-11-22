"use client";

import { useMemo, useState } from "react";
import { Download, Filter, ListChecks } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

type AuditAction = "CREATE" | "UPDATE" | "EXECUTE" | "CANCEL";

export interface TradeAuditRecord {
  id: string;
  timestamp: string;
  tradeId: string;
  action: AuditAction;
  actor: string;
  details: string;
}

interface AuditTrailProps {
  records?: TradeAuditRecord[];
  className?: string;
}

const columnHelper = createColumnHelper<TradeAuditRecord>();

const COLUMNS = [
  columnHelper.accessor("timestamp", {
    header: "Timestamp",
    cell: (info) => <span className="font-mono text-xs">{new Date(info.getValue()).toLocaleString()}</span>,
  }),
  columnHelper.accessor("tradeId", { header: "Trade", cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
  columnHelper.accessor("action", { header: "Action" }),
  columnHelper.accessor("actor", { header: "Actor" }),
  columnHelper.accessor("details", { header: "Details" }),
];

const DEFAULT_RECORDS: TradeAuditRecord[] = [
  { id: "1", timestamp: new Date().toISOString(), tradeId: "T-1001", action: "CREATE", actor: "system", details: "Trade draft created." },
  { id: "2", timestamp: new Date(Date.now() - 60_000).toISOString(), tradeId: "T-1001", action: "EXECUTE", actor: "trader", details: "Trade executed after preview approval." },
  { id: "3", timestamp: new Date(Date.now() - 120_000).toISOString(), tradeId: "T-1002", action: "UPDATE", actor: "system", details: "Fee estimate refreshed." },
];

export default function AuditTrail({ records = DEFAULT_RECORDS, className = "" }: AuditTrailProps) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((record) => record.action === filter);
  }, [filter, records]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  const exportCsv = () => {
    const header = ["Timestamp", "Trade ID", "Action", "Actor", "Details"];
    const rows = filtered.map((row) => [row.timestamp, row.tradeId, row.action, row.actor, `"${row.details.replace(/"/g, '""')}"`]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trade-audit-trail.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--muted)" }}>
            Audit trail
          </p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Trade history log
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Filter logs, inspect timestamps, and export the trail when you need a record of trade actions.
          </p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#0f766e" }}>
          <Download size={16} />
          Export
        </button>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Filter size={16} style={{ color: "var(--muted)" }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}>
          <option value="all">All actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="EXECUTE">Execute</option>
          <option value="CANCEL">Cancel</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: "var(--background)" }}>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top" style={{ color: "var(--foreground)" }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm" style={{ color: "var(--muted)" }}>
        <span className="inline-flex items-center gap-2">
          <ListChecks size={16} />
          {filtered.length} records shown
        </span>
        <span>Page {table.getState().pagination.pageIndex + 1}</span>
      </div>
    </div>
  );
}
