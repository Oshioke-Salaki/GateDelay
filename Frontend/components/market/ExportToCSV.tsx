"use client";

import { useState, useCallback, useRef } from "react";
import {
  Download,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportDataType = "market-snapshots" | "orders" | "balances";
export type ExportStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

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

function statusIcon(status: ExportStatus, size = 14) {
  switch (status) {
    case "completed":
      return <CheckCircle size={size} style={{ color: "#22c55e" }} />;
    case "failed":
      return <XCircle size={size} style={{ color: "#ef4444" }} />;
    case "processing":
    case "pending":
      return (
        <Loader2
          size={size}
          className="animate-spin"
          style={{ color: "#3b82f6" }}
        />
      );
    default:
      return null;
  }
}

function statusLabel(status: ExportStatus): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Processing…";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

function labelForDataType(dt: ExportDataType): string {
  return dt
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function startExportRequest(payload: {
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
  return res.json();
}

async function pollExportStatus(jobId: string): Promise<{
  status: ExportStatus;
  progress: number;
  error?: string;
}> {
  const res = await fetch(`/api/exports/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to poll export status");
  const data = await res.json();
  // The API wraps status in a `status` key
  return data.status ?? data;
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

// ─── Status Banner ────────────────────────────────────────────────────────────
/**
 * Persistent above-the-fold banner that walks through every export state so
 * the user always knows what's happening without opening the History panel.
 *
 * States:
 *   • idle      – nothing rendered (null)
 *   • pending   – blue "Queued" pill + spinner
 *   • processing – blue progress bar + live percentage
 *   • completed – green success card with one-click download
 *   • failed    – red error card with inline message + retry button
 */
function StatusBanner({
  job,
  onDownload,
  onRetry,
  downloading,
}: {
  job: ExportJob | null;
  onDownload: (job: ExportJob) => void;
  onRetry: () => void;
  downloading: boolean;
}) {
  if (!job || job.status === "idle") return null;

  // ── Pending ──────────────────────────────────────────────────────────────
  if (job.status === "pending") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "rgba(59,130,246,.08)",
          border: "1px solid rgba(59,130,246,.3)",
        }}
        role="status"
        aria-live="polite"
        aria-label="Export queued"
      >
        <Loader2 size={16} className="animate-spin shrink-0" style={{ color: "#3b82f6" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#3b82f6" }}>
            Export queued
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {labelForDataType(job.dataType)} — waiting for a worker…
          </p>
        </div>
      </div>
    );
  }

  // ── Processing ────────────────────────────────────────────────────────────
  if (job.status === "processing") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "rgba(59,130,246,.08)",
          border: "1px solid rgba(59,130,246,.3)",
        }}
        role="status"
        aria-live="polite"
        aria-label={`Exporting ${labelForDataType(job.dataType)}, ${job.progress}% complete`}
      >
        <Loader2 size={16} className="animate-spin shrink-0" style={{ color: "#3b82f6" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold" style={{ color: "#3b82f6" }}>
              Exporting {labelForDataType(job.dataType)}
            </p>
            <span className="text-xs font-mono tabular-nums" style={{ color: "#3b82f6" }}>
              {job.progress}%
            </span>
          </div>
          <ProgressBar value={job.progress} />
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Building your CSV file — this usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (job.status === "completed") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "rgba(34,197,94,.08)",
          border: "1px solid rgba(34,197,94,.3)",
        }}
        role="status"
        aria-live="polite"
        aria-label={`Export of ${labelForDataType(job.dataType)} is ready to download`}
      >
        <CheckCircle size={20} className="shrink-0" style={{ color: "#22c55e" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>
            Export ready — {labelForDataType(job.dataType)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Your CSV file is ready. Click Download to save it.
          </p>
        </div>
        <button
          onClick={() => onDownload(job)}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: "#22c55e",
            color: "#fff",
          }}
          aria-label={`Download ${job.filename ?? "export"}`}
        >
          {downloading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          Download
        </button>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (job.status === "failed") {
    return (
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "rgba(239,68,68,.08)",
          border: "1px solid rgba(239,68,68,.3)",
        }}
        role="alert"
        aria-label={`Export of ${labelForDataType(job.dataType)} failed`}
      >
        <XCircle size={20} className="shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
            Export failed — {labelForDataType(job.dataType)}
          </p>
          {job.error && (
            <p
              className="text-xs mt-0.5 font-mono break-all"
              style={{ color: "var(--muted)" }}
            >
              {job.error}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Check your filters or try again. If the issue persists, contact
            support.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity hover:opacity-80 mt-0.5"
          style={{
            background: "rgba(239,68,68,.15)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,.3)",
          }}
          aria-label="Retry export"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  return null;
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-1">
        <label
          htmlFor="export-filter-pair"
          className="text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          Trading Pair
        </label>
        <select
          id="export-filter-pair"
          value={filters.pair ?? ""}
          onChange={(e) =>
            onChange({ ...filters, pair: e.target.value || undefined })
          }
          className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="">All pairs</option>
          {pairs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="export-filter-from"
          className="text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          From
        </label>
        <input
          id="export-filter-from"
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) =>
            onChange({ ...filters, startDate: e.target.value || undefined })
          }
          max={filters.endDate ?? new Date().toISOString().slice(0, 10)}
          className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="export-filter-to"
          className="text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          To
        </label>
        <input
          id="export-filter-to"
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) =>
            onChange({ ...filters, endDate: e.target.value || undefined })
          }
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

// ─── History row ──────────────────────────────────────────────────────────────

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
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--foreground)" }}
          >
            {labelForDataType(job.dataType)}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {new Date(job.createdAt).toLocaleString()} · {statusLabel(job.status)}
          </p>
          {(job.status === "pending" || job.status === "processing") && (
            <ProgressBar value={job.progress} />
          )}
          {job.status === "failed" && job.error && (
            <p className="text-xs mt-0.5 break-all" style={{ color: "#ef4444" }}>
              {job.error}
            </p>
          )}
        </div>
      </div>

      {job.status === "completed" && (
        <button
          onClick={() => onDownload(job)}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0"
          style={{
            background: "rgba(34,197,94,.12)",
            color: "#22c55e",
            border: "1px solid rgba(34,197,94,.26)",
          }}
          aria-label={`Download ${job.filename ?? "export"}`}
        >
          {downloading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          Download
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DATA_TYPES: {
  value: ExportDataType;
  label: string;
  description: string;
}[] = [
  {
    value: "market-snapshots",
    label: "Market Snapshots",
    description: "Price, volume, order book data",
  },
  {
    value: "orders",
    label: "Orders",
    description: "Trade history and order book",
  },
  {
    value: "balances",
    label: "Balances",
    description: "Account balance history",
  },
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

  // Export history (session-local)
  const [history, setHistory] = useState<ExportJob[]>([]);

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── The most recent job drives the status banner ────────────────────────
  // Show the latest job that is not idle so the banner persists after
  // completion/failure until the user starts a new export.
  const bannerJob = history[0] ?? null;

  // ─── Start export ──────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { jobId } = await startExportRequest({
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

      // Poll for status updates
      pollRef.current = setInterval(async () => {
        try {
          const statusData = await pollExportStatus(jobId);

          setHistory((prev) =>
            prev.map((j) =>
              j.jobId === jobId
                ? {
                    ...j,
                    status: statusData.status,
                    progress: statusData.progress,
                    error: statusData.error,
                  }
                : j,
            ),
          );

          if (statusData.status === "completed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.success(
              "Export ready",
              "Your CSV file is ready to download.",
            );
          } else if (statusData.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.error(
              "Export failed",
              statusData.error ?? "Unknown error",
            );
          }
        } catch {
          // transient network error — keep polling
        }
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Create a synthetic failed job so the banner shows the error state
      const failedJob: ExportJob = {
        jobId: `failed-${Date.now()}`,
        dataType,
        status: "failed",
        progress: 0,
        createdAt: new Date().toISOString(),
        filename: `${dataType}_export.csv`,
        error: msg,
      };
      setHistory((prev) => [failedJob, ...prev]);
      setShowHistory(true);
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
        await downloadExport(
          job.jobId,
          job.filename ?? `${job.dataType}_export.csv`,
        );
        toast.success("Downloaded", "Your CSV has been saved.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("Download failed", msg);
      } finally {
        setDownloading(null);
      }
    },
    [toast],
  );

  // ─── Retry — re-runs the export with the same dataType + filters ──────────

  const handleRetry = useCallback(() => {
    handleExport();
  }, [handleExport]);

  // ─── Whether the export button should be disabled ─────────────────────────

  const isInFlight =
    bannerJob?.status === "pending" || bannerJob?.status === "processing";

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Export Market Data
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Download filtered datasets as CSV files
          </p>
        </div>

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

      {/* Data type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DATA_TYPES.map((dt) => (
          <button
            key={dt.value}
            onClick={() => setDataType(dt.value)}
            className="flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              background:
                dataType === dt.value ? "#3b82f615" : "var(--card)",
              border: `1px solid ${dataType === dt.value ? "#3b82f6" : "var(--border)"}`,
              color: "var(--foreground)",
            }}
            aria-pressed={dataType === dt.value}
          >
            <span className="text-sm font-semibold">{dt.label}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {dt.description}
            </span>
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
            {
              [filters.pair, filters.startDate, filters.endDate].filter(
                Boolean,
              ).length
            }{" "}
            active
          </span>
        )}
      </button>

      {showFilters && (
        <FilterPanel filters={filters} pairs={pairs} onChange={setFilters} />
      )}

      {/*
       * ── Status banner ──────────────────────────────────────────────────────
       * Always visible above the Export button. Walks through:
       *   pending → processing (live %) → completed (download CTA) → failed (error + retry)
       */}
      <StatusBanner
        job={bannerJob}
        onDownload={handleDownload}
        onRetry={handleRetry}
        downloading={downloading === bannerJob?.jobId}
      />

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting || isInFlight}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ background: "#3b82f6", color: "#fff" }}
        aria-busy={exporting || isInFlight}
      >
        {exporting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Starting export…
          </>
        ) : isInFlight ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Export in progress…
          </>
        ) : (
          <>
            <Download size={16} />
            Export to CSV
          </>
        )}
      </button>

      {/* Export history panel */}
      {showHistory && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--muted)" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Export History
            </h3>
          </div>

          {history.length === 0 ? (
            <div
              className="px-4 py-6 rounded-xl text-center text-sm"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
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
