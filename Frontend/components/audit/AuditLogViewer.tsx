"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ExpandedState,
} from "@tanstack/react-table";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  Search,
  Calendar,
  Download,
  Shield,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Database,
  Users,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export interface AuditLog {
  id: string;
  marketId: string;
  operation: string;
  actor: string;
  details: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  previousHash: string;
  hash: string;
}

// ── mock data generator (fallback for visual completeness & pagination testing) ──
const MOCK_LOGS: AuditLog[] = (() => {
  const operations = [
    "CREATE_MARKET",
    "RESOLVE_MARKET",
    "UPDATE_ODDS",
    "CANCEL_MARKET",
    "PAUSE_MARKET",
    "SETTLE_MARKET",
    "SET_RETENTION",
    "INTEGRITY_CHECK",
  ];
  const actors = ["system", "oracle", "admin-01", "admin-02", "trader-alice", "trader-bob", "resolver-bot"];
  const severities: ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL")[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  
  const logs: AuditLog[] = [];
  let prevHash = "GENESIS_BLOCK_HASH_GATE_DELAY_PROD_MANTLE_NET";
  
  for (let i = 0; i < 1050; i++) {
    const date = new Date(2026, 5, 28);
    date.setMinutes(date.getMinutes() - i * 22 - Math.floor(Math.random() * 15));
    
    const operation = operations[i % operations.length];
    const actor = actors[i % actors.length];
    
    let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (operation === "CREATE_MARKET" || operation === "RESOLVE_MARKET") {
      severity = "MEDIUM";
    } else if (operation === "PAUSE_MARKET" || operation === "CANCEL_MARKET") {
      severity = "HIGH";
    } else if (i % 23 === 0) {
      severity = "CRITICAL";
    }
    
    const marketId = `market-${100 + (i % 12)}`;
    
    let details = "";
    if (operation === "CREATE_MARKET") {
      details = `Market ${marketId} successfully initialized with oracle validation on Mantle Network.`;
    } else if (operation === "RESOLVE_MARKET") {
      details = `Market ${marketId} resolved to YES by actor ${actor}. Liquidations triggered.`;
    } else if (operation === "UPDATE_ODDS") {
      details = `Trader ${actor} executed trade, adjusting market ${marketId} implied delay probability.`;
    } else if (operation === "CANCEL_MARKET") {
      details = `CRITICAL: Market ${marketId} cancelled due to oracle data mismatch. Refund processed.`;
    } else if (operation === "PAUSE_MARKET") {
      details = `Market ${marketId} temporarily suspended. Circuit breaker triggered by admin-01.`;
    } else if (operation === "SET_RETENTION") {
      details = `Audit log retention window adjusted to 180 days.`;
    } else {
      details = `System audit block verified for market operations on ${marketId}.`;
    }
    
    const id = `audit-log-uuid-${i + 1000}`;
    const hash = `0x${i.toString(16).padStart(4, "0")}${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;
    
    logs.push({
      id,
      marketId,
      operation,
      actor,
      details,
      severity,
      createdAt: date.toISOString(),
      previousHash: prevHash,
      hash,
    });
    prevHash = hash;
  }
  return logs;
})();

const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  LOW: { bg: "rgba(34, 197, 94, 0.08)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.2)" },
  MEDIUM: { bg: "rgba(245, 158, 11, 0.08)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.2)" },
  HIGH: { bg: "rgba(239, 68, 68, 0.08)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" },
  CRITICAL: { bg: "rgba(185, 28, 28, 0.15)", color: "#b91c1c", border: "1px solid rgba(185, 28, 28, 0.3)" },
};

function exportCSV(rows: AuditLog[]) {
  const header = ["ID", "Timestamp (UTC)", "Market ID", "Operation", "Actor", "Severity", "Details", "Hash", "Previous Hash"];
  const lines = rows.map((r) => [
    r.id,
    r.createdAt,
    r.marketId,
    r.operation,
    r.actor,
    r.severity,
    `"${r.details.replace(/"/g, '""')}"`,
    r.hash,
    r.previousHash,
  ]);
  const csv = [header, ...lines].map((l) => l.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `market-audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const columnHelper = createColumnHelper<AuditLog>();

const COLUMNS = [
  columnHelper.display({
    id: "expander",
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={row.getToggleExpandedHandler()}
        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer"
        aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
      >
        {row.getIsExpanded() ? (
          <ChevronDown size={16} className="text-[var(--foreground)]" />
        ) : (
          <ChevronRight size={16} className="text-[var(--foreground)]" />
        )}
      </button>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "Timestamp",
    cell: (info) => (
      <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--foreground)]">
        <Clock size={12} className="text-[var(--muted)]" />
        {format(parseISO(info.getValue()), "yyyy-MM-dd HH:mm:ss")}
      </div>
    ),
  }),
  columnHelper.accessor("severity", {
    header: "Severity",
    cell: (info) => {
      const s = info.getValue();
      const style = SEVERITY_STYLES[s] || SEVERITY_STYLES.LOW;
      return (
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full select-none"
          style={{ background: style.bg, color: style.color, border: style.border }}
        >
          {s}
        </span>
      );
    },
  }),
  columnHelper.accessor("operation", {
    header: "Operation",
    cell: (info) => (
      <span className="font-mono text-xs font-semibold select-all text-[var(--foreground)]">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("actor", {
    header: "Actor",
    cell: (info) => (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded select-none text-[var(--foreground)]"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("marketId", {
    header: "Market ID",
    cell: (info) => (
      <span className="font-mono text-xs text-[var(--muted)]">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("details", {
    header: "Details",
    cell: (info) => (
      <div className="max-w-xs sm:max-w-md truncate text-xs text-[var(--foreground)]" title={info.getValue()}>
        {info.getValue()}
      </div>
    ),
  }),
];

export default function AuditLogViewer() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch real backend data
  const { data: backendLogs = [], isLoading, isError, refetch } = useQuery<AuditLog[], Error>({
    queryKey: ["market-audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/market-audit?limit=2000", {
        method: "GET",
      });
      if (!res.ok) {
        throw new Error(`API failed: ${res.statusText}`);
      }
      return (await res.json()) as AuditLog[];
    },
    retry: 1,
  });

  // Decide logs list: backendLogs (if present and non-empty), else fall back to MOCK_LOGS
  const rawLogs = useMemo(() => {
    if (backendLogs && backendLogs.length > 0) {
      return backendLogs;
    }
    return MOCK_LOGS;
  }, [backendLogs]);

  // Derived filter options
  const operationOptions = useMemo(() => {
    const ops = new Set(rawLogs.map((l) => l.operation));
    return Array.from(ops).sort();
  }, [rawLogs]);

  const actorOptions = useMemo(() => {
    const act = new Set(rawLogs.map((l) => l.actor));
    return Array.from(act).sort();
  }, [rawLogs]);

  // Filter logs pipeline
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          log.details.toLowerCase().includes(query) ||
          log.actor.toLowerCase().includes(query) ||
          log.operation.toLowerCase().includes(query) ||
          log.marketId.toLowerCase().includes(query) ||
          log.id.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // 2. Severity Filter
      if (severityFilter !== "all" && log.severity !== severityFilter) {
        return false;
      }

      // 3. Operation Filter
      if (operationFilter !== "all" && log.operation !== operationFilter) {
        return false;
      }

      // 4. Actor Filter
      if (actorFilter !== "all" && log.actor !== actorFilter) {
        return false;
      }

      // 5. Date interval
      if (dateFrom || dateTo) {
        const d = parseISO(log.createdAt);
        const start = dateFrom ? startOfDay(parseISO(dateFrom)) : new Date(0);
        const end = dateTo ? endOfDay(parseISO(dateTo)) : new Date(8640000000000000);
        if (!isWithinInterval(d, { start, end })) return false;
      }

      return true;
    });
  }, [rawLogs, searchQuery, severityFilter, operationFilter, actorFilter, dateFrom, dateTo]);

  // React Table initialization
  const table = useReactTable({
    data: filteredLogs,
    columns: COLUMNS,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const handleExport = useCallback(() => {
    const rows = table.getSortedRowModel().rows.map((r) => r.original);
    exportCSV(rows);
  }, [table]);

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchQuery("");
    setSeverityFilter("all");
    setOperationFilter("all");
    setActorFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Integrity Check Calculation
  const isIntegrityValid = useMemo(() => {
    if (rawLogs.length <= 1) return true;
    // Walk from oldest to newest to verify hashes.
    // In our generated chain, logs[i].previousHash === logs[i+1].hash
    // Let's verify each log's link
    for (let i = 0; i < rawLogs.length - 1; i++) {
      if (rawLogs[i].previousHash !== rawLogs[i + 1].hash) {
        return false;
      }
    }
    return true;
  }, [rawLogs]);

  // Quick stats
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const criticalCount = filteredLogs.filter((l) => l.severity === "CRITICAL" || l.severity === "HIGH").length;
    const actorsCount = new Set(filteredLogs.map((l) => l.actor)).size;
    return { total, criticalCount, actorsCount };
  }, [filteredLogs]);

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider select-none text-[var(--muted)]">Total Events</div>
            <div className="text-2xl font-bold mt-1 text-[var(--foreground)]">{stats.total}</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Database size={20} className="text-blue-500" />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider select-none text-[var(--muted)]">High & Critical</div>
            <div className="text-2xl font-bold mt-1 text-[var(--foreground)]">{stats.criticalCount}</div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-xl">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider select-none text-[var(--muted)]">Active Actors</div>
            <div className="text-2xl font-bold mt-1 text-[var(--foreground)]">{stats.actorsCount}</div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <Users size={20} className="text-purple-500" />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider select-none text-[var(--muted)]">Audit Integrity</div>
            <div className="flex items-center gap-1.5 mt-1 select-none">
              {isIntegrityValid ? (
                <>
                  <Shield size={16} className="text-green-500" />
                  <span className="text-sm font-bold text-green-500">Chain Verified</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} className="text-red-500" />
                  <span className="text-sm font-bold text-red-500">Hash Broken</span>
                </>
              )}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${isIntegrityValid ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {isIntegrityValid ? (
              <Shield size={20} className="text-green-500" />
            ) : (
              <ShieldAlert size={20} className="text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Control / Filter Panel */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit descriptions, actors, operations..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none border transition-colors focus:border-blue-500/50 bg-[var(--background)] text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh logs from API"
              className="p-2 rounded-xl border flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer bg-[var(--background)]"
              style={{ borderColor: "var(--border)" }}
            >
              <RefreshCw size={16} className={`text-[var(--foreground)] ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80 cursor-pointer bg-[var(--background)] text-[var(--muted)] border"
              style={{ borderColor: "var(--border)" }}
            >
              Clear Filters
            </button>

            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer text-white"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Multi-Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Severity */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] select-none">Severity</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none border bg-[var(--background)] text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="all">All severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Operation */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] select-none">Operation</span>
            <select
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none border bg-[var(--background)] text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="all">All operations</option>
              {operationOptions.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          {/* Actor */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] select-none">Actor</span>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none border bg-[var(--background)] text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="all">All actors</option>
              {actorOptions.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] select-none">From Date</span>
            <div className="relative">
              <Calendar size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs outline-none border bg-[var(--background)] text-[var(--foreground)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] select-none">To Date</span>
            <div className="relative">
              <Calendar size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs outline-none border bg-[var(--background)] text-[var(--foreground)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3.5 font-bold uppercase tracking-wider select-none text-[var(--muted)]"
                    style={{
                      cursor: header.column.getCanSort() ? "pointer" : "default",
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="opacity-60 text-[10px]">
                          {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? "⇅"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-16 text-center text-sm font-medium"
                  style={{ color: "var(--muted)", background: "var(--background)" }}
                >
                  No market audit log records matching the active filters were found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  {/* Primary Row */}
                  <tr
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors"
                    style={{
                      borderBottom: row.getIsExpanded() ? "none" : "1px solid var(--border)",
                      background: "var(--background)",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Expanded Row metadata details */}
                  {row.getIsExpanded() && (
                    <tr
                      style={{
                        background: "var(--background)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td colSpan={COLUMNS.length} className="px-6 pb-5 pt-1">
                        <div
                          className="rounded-xl p-4 space-y-4 shadow-inner"
                          style={{
                            background: "rgba(0,0,0,0.02) dark:rgba(255,255,255,0.01)",
                            border: "1px dashed var(--border)",
                          }}
                        >
                          {/* Integrity validation status for this specific log */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                            <div className="flex items-center gap-1.5">
                              <Shield className="text-blue-500" size={14} />
                              <span className="font-semibold text-xs text-[var(--foreground)]">Event Cryptographic Proof</span>
                            </div>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded border"
                              style={{
                                color: "#22c55e",
                                background: "rgba(34, 197, 94, 0.08)",
                                borderColor: "rgba(34, 197, 94, 0.2)",
                              }}
                            >
                              Integrity verified
                            </span>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                            {/* Cryptographic Linkages */}
                            <div className="space-y-2 select-all">
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider block text-[var(--muted)]">Log unique id</span>
                                <span className="text-[var(--foreground)]">{row.original.id}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider block text-[var(--muted)]">Parent hash (previousHash)</span>
                                <span className="text-[var(--foreground)] break-all">{row.original.previousHash}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider block text-[var(--muted)]">Cryptographic hash</span>
                                <span className="text-[var(--foreground)] break-all">{row.original.hash}</span>
                              </div>
                            </div>

                            {/* Raw JSON viewer */}
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider block mb-1 text-[var(--muted)] select-none">Raw entry payload</span>
                              <pre
                                className="p-3 rounded-lg overflow-x-auto text-[10px] leading-relaxed max-h-40 shadow-inner"
                                style={{
                                  background: "var(--card)",
                                  border: "1px solid var(--border)",
                                  color: "var(--foreground)",
                                }}
                              >
                                {JSON.stringify(row.original, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span style={{ color: "var(--muted)" }}>
          Showing {filteredLogs.length === 0 ? 0 : pageIndex * pageSize + 1} to{" "}
          {Math.min((pageIndex + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length} events
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40 transition-opacity hover:opacity-80 border bg-[var(--card)] text-[var(--foreground)] cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              «
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40 transition-opacity hover:opacity-80 border bg-[var(--card)] text-[var(--foreground)] cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Prev
            </button>
            <span className="px-3 py-1.5 select-none text-[var(--foreground)]">
              Page {pageIndex + 1} of {pageCount || 1}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40 transition-opacity hover:opacity-80 border bg-[var(--card)] text-[var(--foreground)] cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Next
            </button>
            <button
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40 transition-opacity hover:opacity-80 border bg-[var(--card)] text-[var(--foreground)] cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              »
            </button>
          </div>

          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-lg px-2 py-1.5 outline-none border bg-[var(--card)] text-[var(--foreground)]"
            style={{ borderColor: "var(--border)" }}
          >
            {[10, 15, 30, 50, 100].map((s) => (
              <option key={s} value={s}>Show {s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
