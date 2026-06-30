"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, History } from "lucide-react";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportDataType = "market-snapshots" | "orders" | "balances";
export type ExportStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export interface ExportFilters {
  pair?: string;
  startDate?: string;
  endDate?: string;
}

export interface ExportJob {
  jobId: string;
  dataType: ExportDataType;
  status: ExportStatus;
  progress: number;
  createdAt: string;
  filename?: string;
  error?: string;
}

interface ExportToCSVProps {
  /** Pre-select a trading pair for filtering */
  defaultPair?: string;
  /** User ID for scoped exports */
  userId?: string;
  /** Available trading pairs to filter by */
  pairs?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statusIcon(status: ExportStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle size={14} className="text-green-500" />;
    case "failed":
      return <XCircle size={14} className="text-red-500" />;
    case "processing":
    case "pending":
      return <Loader2 size={14} className="animate-spin" style={{ color: "var(--muted)" }} />;
    default:
      return null;
  }
}

function statusLabel(status: ExportStatus): string {
  switch (status) {
    case "pending":    return "Queued";
    case "processing": return "Processing…";
    case "completed":  return "Ready";
    case "failed":     return "Failed";
    default:           return "Idle";
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function startExport(payload: {
  userId?: string;
  dataType: ExportDataType;
  format: "csv";
  options: ExportFilters;
}): Promise<{ jobId: string }> {
  const res = await fetch("/api/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to start export");
  const data = await res.json();
  return data;
}

async function pollExportStatus(jobId: string): Promise<{
  status: ExportStatus;
  progress: number;
  format?: string;
  dataType?: string;
  error?: string;
}> {
  const res = await fetch(`/api/exports/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to poll export status");
  const data = await res.json();
  return data.status;
}

async function downloadExport(jobId: string, filename: string): Promise<void> {
  const res = await fetch(`/api/exports/download/${jobId}`);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--border)" }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${value}%`,
          background: value === 100 ? "#22c55e" : "#3b82f6",
        }}
      />
    </div>
  );
}

function FilterPanel({
  filters,
  pairs,
  onChange,
}: {
  filters: ExportFilters;
  pairs: string[];
  onChange: (f: ExportFilters) => void;
}) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Pair filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          Trading Pair
        </label>
        <select
          value={filters.pair ?? ""}
          onChange={(e) => onChange({ ...filters, pair: e.target.value || undefined })}
          className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="">All pairs</option>
          {pairs.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Start date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          From
        </label>
        <input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
          max={filters.endDate ?? new Date().toISOString().slice(0, 10)}
          className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />
      </div>

      {/* End date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          To
        </label>
        <input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
          min={filters.startDate}
          max={new Date().toISOString().slice(0, 10)}
          className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />
      </div>
    </div>
  );
}

function HistoryRow({
  job,
  onDownload,
  downloading,
}: {
  job: ExportJob;
  onDownload: (job: ExportJob) => void;
  downloading: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon(job.status)}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
            {job.dataType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {new Date(job.createdAt).toLocaleString()} · {statusLabel(job.status)}
          </p>
          {(job.status === "pending" || job.status === "processing") && (
            <ProgressBar value={job.progress} />
          )}
          {job.status === "failed" && job.error && (
            <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>{job.error}</p>
          )}
        </div>
      </div>

      {job.status === "completed" && (
        <button
          onClick={() => onDownload(job)}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0"
          style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e44" }}
          aria-label={`Download ${job.filename ?? "export"}`}
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DATA_TYPES: { value: ExportDataType; label: string; description: string }[] = [
  { value: "market-snapshots", label: "Market Snapshots", description: "Price, volume, order book data" },
  { value: "orders",           label: "Orders",           description: "Trade history and order book" },
  { value: "balances",         label: "Balances",         description: "Account balance history" },
];

const DEFAULT_PAIRS = ["BTC/USDT", "ETH/USDT", "MNT/USDT", "SOL/USDT"];

export default function ExportToCSV({
  defaultPair,
  userId,
  pairs = DEFAULT_PAIRS,
}: ExportToCSVProps) {
  const toast = useToast();

  // UI state
  const [dataType, setDataType] = useState<ExportDataType>("market-snapshots");
  const [filters, setFilters] = useState<ExportFilters>({ pair: defaultPair });
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Export history (local session state)
  const [history, setHistory] = useState<ExportJob[]>([]);

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Start Export ──────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { jobId } = await startExport({
        userId,
        dataType,
        format: "csv",
        options: filters,
      });

      const newJob: ExportJob = {
        jobId,
        dataType,
        status: "pending",
        progress: 0,
        createdAt: new Date().toISOString(),
        filename: `${dataType}_export.csv`,
      };

      setHistory((prev) => [newJob, ...prev]);
      setShowHistory(true);
      toast.info("Export started", "Your CSV is being prepared…");

      // Poll for progress
      pollRef.current = setInterval(async () => {
        try {
          const statusData = await pollExportStatus(jobId);

          setHistory((prev) =>
            prev.map((j) =>
              j.jobId === jobId
                ? { ...j, status: statusData.status, progress: statusData.progress, error: statusData.error }
                : j
            )
          );

          if (statusData.status === "completed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.success("Export ready", "Your CSV file is ready to download.");
          } else if (statusData.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.error("Export failed", statusData.error ?? "Unknown error");
          }
        } catch {
          // keep polling
        }
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Export failed", msg);
    } finally {
      setExporting(false);
    }
  }, [userId, dataType, filters, toast]);

  // ─── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(
    async (job: ExportJob) => {
      setDownloading(job.jobId);
      try {
        await downloadExport(job.jobId, job.filename ?? `${job.dataType}_export.csv`);
        toast.success("Downloaded", "Your CSV has been saved.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("Download failed", msg);
      } finally {
        setDownloading(null);
      }
    },
    [toast]
  );

  // ─── Active job for progress display ──────────────────────────────────────

  const activeJob = history.find(
    (j) => j.status === "pending" || j.status === "processing"
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            Export Market Data
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Download filtered datasets as CSV files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
            aria-expanded={showHistory}
          >
            <History size={14} />
            History
            {history.length > 0 && (
              <span
                className="ml-1 text-xs font-bold rounded-full px-1.5 py-0.5"
                style={{ background: "#3b82f620", color: "#3b82f6" }}
              >
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Data type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DATA_TYPES.map((dt) => (
          <button
            key={dt.value}
            onClick={() => setDataType(dt.value)}
            className="flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background: dataType === dt.value ? "#3b82f615" : "var(--card)",
              border: `1px solid ${dataType === dt.value ? "#3b82f6" : "var(--border)"}`,
              color: "var(--foreground)",
            }}
            aria-pressed={dataType === dt.value}
          >
            <span className="text-sm font-semibold">{dt.label}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{dt.description}</span>
          </button>
        ))}
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80 self-start"
        style={{ color: "var(--muted)" }}
        aria-expanded={showFilters}
      >
        <Filter size={14} />
        Filters
        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {(filters.pair || filters.startDate || filters.endDate) && (
          <span
            className="text-xs font-bold rounded-full px-1.5 py-0.5"
            style={{ background: "#3b82f620", color: "#3b82f6" }}
          >
            {[filters.pair, filters.startDate, filters.endDate].filter(Boolean).length} active
          </span>
        )}
      </button>

      {showFilters && (
        <FilterPanel filters={filters} pairs={pairs} onChange={setFilters} />
      )}

      {/* Active export progress inline */}
      {activeJob && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          role="status"
          aria-live="polite"
        >
          <Loader2 size={16} className="animate-spin shrink-0" style={{ color: "#3b82f6" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Exporting {activeJob.dataType.replace(/-/g, " ")}… {activeJob.progress}%
            </p>
            <ProgressBar value={activeJob.progress} />
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting || !!activeJob}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ background: "#3b82f6", color: "#fff" }}
        aria-busy={exporting}
      >
        {exporting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {exporting ? "Starting export…" : "Export to CSV"}
      </button>

      {/* Export history */}
      {showHistory && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--muted)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Export History
            </h3>
          </div>

          {history.length === 0 ? (
            <div
              className="px-4 py-6 rounded-xl text-center text-sm"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              No exports yet this session
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {history.map((job) => (
                <HistoryRow
                  key={job.jobId}
                  job={job}
                  onDownload={handleDownload}
                  downloading={downloading === job.jobId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
