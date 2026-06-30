"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Upload, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Loader2, Scale, FileText, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
export type DisputeOutcome = "USER_WIN" | "ADMIN_WIN" | "SYSTEM_DECISION" | "REJECTED";

export interface DisputeEvidence {
  url: string;
  uploadedBy: string;
  description: string;
  timestamp: string;
}

export interface DisputeResolutionData {
  outcome: DisputeOutcome;
  decidedBy: string;
  summary: string;
  txHash?: string | null;
  decidedAt: string;
}

export interface Dispute {
  _id: string;
  marketId: string;
  userId: string;
  status: DisputeStatus;
  reason: string;
  description: string;
  evidence: DisputeEvidence[];
  resolution?: DisputeResolutionData;
  createdAt: string;
  updatedAt: string;
  reviewStartedAt?: string | null;
  resolvedAt?: string | null;
}

interface CreateDisputeForm {
  reason: string;
  description: string;
}

interface EvidenceForm {
  url: string;
  description: string;
}

interface DisputeResolutionProps {
  marketId: string;
  userId: string;
  /** If true, shows admin resolve/reject controls */
  isAdmin?: boolean;
  adminId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REASON_OPTIONS = [
  { value: "incorrect_resolution", label: "Incorrect Resolution" },
  { value: "data_error",           label: "Data Error" },
  { value: "technical_issue",      label: "Technical Issue" },
  { value: "fraud_suspicion",      label: "Fraud Suspicion" },
  { value: "other",                label: "Other" },
];

const STATUS_CONFIG: Record<DisputeStatus, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  OPEN:         { label: "Open",        color: "#f59e0b", bg: "#f59e0b15", Icon: AlertTriangle },
  UNDER_REVIEW: { label: "In Review",   color: "#3b82f6", bg: "#3b82f615", Icon: Eye },
  RESOLVED:     { label: "Resolved",    color: "#22c55e", bg: "#22c55e15", Icon: CheckCircle },
  REJECTED:     { label: "Rejected",    color: "#ef4444", bg: "#ef444415", Icon: XCircle },
};

const OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  USER_WIN:        "User Won",
  ADMIN_WIN:       "Admin Won",
  SYSTEM_DECISION: "System Decision",
  REJECTED:        "Rejected",
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchDisputeByUserMarket(userId: string, marketId: string): Promise<Dispute | null> {
  const res = await fetch(`/api/disputes/user/${userId}/market/${marketId}`);
  if (!res.ok) throw new Error("Failed to load dispute");
  const data = await res.json();
  return data.data ?? null;
}

async function createDisputeApi(payload: {
  marketId: string; userId: string; reason: string; description: string;
}): Promise<Dispute> {
  const res = await fetch("/api/disputes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": payload.userId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create dispute");
  }
  return (await res.json()).data;
}

async function addEvidenceApi(
  disputeId: string, userId: string, evidence: { url: string; description: string }
): Promise<Dispute> {
  const res = await fetch(`/api/disputes/${disputeId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ evidence }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to add evidence");
  }
  return (await res.json()).data;
}

async function resolveDisputeApi(
  disputeId: string, adminId: string,
  payload: { outcome: DisputeOutcome; summary: string; txHash?: string }
): Promise<Dispute> {
  const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to resolve dispute");
  }
  return (await res.json()).data;
}

async function rejectDisputeApi(disputeId: string, adminId: string, reason: string): Promise<Dispute> {
  const res = await fetch(`/api/disputes/${disputeId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to reject dispute");
  }
  return (await res.json()).data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DisputeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function EvidenceList({ evidence }: { evidence: DisputeEvidence[] }) {
  if (evidence.length === 0) return (
    <p className="text-xs" style={{ color: "var(--muted)" }}>No evidence attached yet</p>
  );
  return (
    <ul className="flex flex-col gap-2">
      {evidence.map((e, i) => (
        <li key={i} className="flex items-start gap-2">
          <FileText size={13} className="shrink-0 mt-0.5" style={{ color: "var(--muted)" }} />
          <div className="min-w-0">
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium underline truncate block"
              style={{ color: "#3b82f6" }}
            >
              Evidence {i + 1}
            </a>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{e.description}</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {new Date(e.timestamp).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResolutionCard({ resolution }: { resolution: DisputeResolutionData }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "#22c55e10", border: "1px solid #22c55e30" }}>
      <div className="flex items-center gap-2">
        <Scale size={14} style={{ color: "#22c55e" }} />
        <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
          {OUTCOME_LABELS[resolution.outcome]}
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--foreground)" }}>{resolution.summary}</p>
      {resolution.txHash && (
        <p className="text-xs font-mono truncate" style={{ color: "var(--muted)" }}>
          Tx: {resolution.txHash}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Decided {new Date(resolution.decidedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DisputeResolution({
  marketId, userId, isAdmin = false, adminId,
}: DisputeResolutionProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState(false);

  // Admin resolve form state
  const [resolveOutcome, setResolveOutcome] = useState<DisputeOutcome>("USER_WIN");
  const [resolveSummary, setResolveSummary] = useState("");
  const [resolveTxHash, setResolveTxHash] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // ─── Forms ──────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateDisputeForm>();
  const evidenceForm = useForm<EvidenceForm>();

  // ─── Queries ────────────────────────────────────────────────────────────────

  const queryKey = ["dispute", userId, marketId];

  const { data: dispute, isLoading, isError } = useQuery<Dispute | null>({
    queryKey,
    queryFn: () => fetchDisputeByUserMarket(userId, marketId),
    staleTime: 30_000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: CreateDisputeForm) =>
      createDisputeApi({ marketId, userId, ...data }),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKey, created);
      setShowCreateForm(false);
      createForm.reset();
      toast.success("Dispute submitted", "Your dispute is now open for review.");
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  const evidenceMutation = useMutation({
    mutationFn: (data: EvidenceForm) =>
      addEvidenceApi(dispute!._id, userId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setShowEvidenceForm(false);
      evidenceForm.reset();
      toast.success("Evidence added", "Your evidence has been attached.");
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      resolveDisputeApi(dispute!._id, adminId!, {
        outcome: resolveOutcome,
        summary: resolveSummary,
        txHash: resolveTxHash || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setShowAdminPanel(false);
      toast.success("Dispute resolved", `Outcome: ${OUTCOME_LABELS[resolveOutcome]}`);
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectDisputeApi(dispute!._id, adminId!, rejectReason),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setShowAdminPanel(false);
      toast.success("Dispute rejected");
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  const canAddEvidence = dispute &&
    (dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") &&
    dispute.userId === userId;

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--muted)" }}>
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading dispute…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "#ef4444" }}>
        <XCircle size={16} />
        <span className="text-sm">Failed to load dispute data</span>
      </div>
    );
  }

  // ─── No dispute yet ─────────────────────────────────────────────────────────

  if (!dispute) {
    return (
      <div className="flex flex-col gap-4 font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Dispute</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              File a dispute if you believe this market has an error
            </p>
          </div>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b44" }}
            >
              <AlertTriangle size={14} />
              File Dispute
            </button>
          )}
        </div>

        {showCreateForm && (
          <form
            onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))}
            className="flex flex-col gap-4 p-4 rounded-xl"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              Create Dispute
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Reason *</label>
              <select
                {...createForm.register("reason", { required: "Select a reason" })}
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="">Select a reason…</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {createForm.formState.errors.reason && (
                <p className="text-xs" style={{ color: "#ef4444" }}>
                  {createForm.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                Description * (min 10 chars)
              </label>
              <textarea
                {...createForm.register("description", {
                  required: "Description required",
                  minLength: { value: 10, message: "At least 10 characters" },
                })}
                rows={4}
                placeholder="Describe the issue in detail…"
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              {createForm.formState.errors.description && (
                <p className="text-xs" style={{ color: "#ef4444" }}>
                  {createForm.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#fff" }}
              >
                {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Submit Dispute
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); createForm.reset(); }}
                className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ─── Existing dispute view ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Dispute</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Filed {new Date(dispute.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={dispute.status} />
      </div>

      {/* Dispute card */}
      <div
        className="flex flex-col gap-3 p-4 rounded-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {REASON_OPTIONS.find((r) => r.value === dispute.reason)?.label ?? dispute.reason}
            </p>
          </div>
          <button
            onClick={() => setExpandedDetail((v) => !v)}
            className="shrink-0 p-1 rounded transition-opacity hover:opacity-80"
            style={{ color: "var(--muted)" }}
            aria-expanded={expandedDetail}
            aria-label="Toggle dispute details"
          >
            {expandedDetail ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {expandedDetail && (
          <div className="flex flex-col gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Description</p>
              <p className="text-sm" style={{ color: "var(--foreground)" }}>{dispute.description}</p>
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>
                Evidence ({dispute.evidence.length})
              </p>
              <EvidenceList evidence={dispute.evidence} />
            </div>

            {dispute.reviewStartedAt && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                <Clock size={12} />
                Review started {new Date(dispute.reviewStartedAt).toLocaleString()}
              </div>
            )}

            {dispute.resolution && <ResolutionCard resolution={dispute.resolution} />}
          </div>
        )}
      </div>

      {/* Add evidence (user, while open/under review) */}
      {canAddEvidence && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowEvidenceForm((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium self-start transition-opacity hover:opacity-80"
            style={{ color: "#3b82f6" }}
            aria-expanded={showEvidenceForm}
          >
            <Upload size={14} />
            {showEvidenceForm ? "Cancel" : "Add Evidence"}
          </button>

          {showEvidenceForm && (
            <form
              onSubmit={evidenceForm.handleSubmit((d) => evidenceMutation.mutate(d))}
              className="flex flex-col gap-3 p-4 rounded-xl"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  Evidence URL * (IPFS or CDN)
                </label>
                <input
                  type="url"
                  {...evidenceForm.register("url", { required: "URL required" })}
                  placeholder="https://ipfs.io/ipfs/..."
                  className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                {evidenceForm.formState.errors.url && (
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    {evidenceForm.formState.errors.url.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Description *</label>
                <input
                  type="text"
                  {...evidenceForm.register("description", { required: "Description required" })}
                  placeholder="Describe this evidence…"
                  className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                {evidenceForm.formState.errors.description && (
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    {evidenceForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={evidenceMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold self-start transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "#3b82f6", color: "#fff" }}
              >
                {evidenceMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Attach Evidence
              </button>
            </form>
          )}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && adminId && (dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowAdminPanel((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium self-start transition-opacity hover:opacity-80"
            style={{ color: "#a855f7" }}
            aria-expanded={showAdminPanel}
          >
            <Scale size={14} />
            {showAdminPanel ? "Close Admin Panel" : "Admin: Resolve / Reject"}
          </button>

          {showAdminPanel && (
            <div
              className="flex flex-col gap-4 p-4 rounded-xl"
              style={{ background: "var(--card)", border: "1px solid #a855f740" }}
            >
              {/* Resolve section */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a855f7" }}>
                  Resolve Dispute
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["USER_WIN", "ADMIN_WIN", "SYSTEM_DECISION", "REJECTED"] as DisputeOutcome[]).map((o) => (
                    <button
                      key={o}
                      onClick={() => setResolveOutcome(o)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: resolveOutcome === o ? "#a855f720" : "var(--background)",
                        border: `1px solid ${resolveOutcome === o ? "#a855f7" : "var(--border)"}`,
                        color: resolveOutcome === o ? "#a855f7" : "var(--muted)",
                      }}
                      aria-pressed={resolveOutcome === o}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>

                <textarea
                  value={resolveSummary}
                  onChange={(e) => setResolveSummary(e.target.value)}
                  rows={3}
                  placeholder="Decision summary…"
                  className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />

                <input
                  type="text"
                  value={resolveTxHash}
                  onChange={(e) => setResolveTxHash(e.target.value)}
                  placeholder="Transaction hash (optional)"
                  className="rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />

                <button
                  onClick={() => resolveMutation.mutate()}
                  disabled={!resolveSummary.trim() || resolveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold self-start transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "#a855f7", color: "#fff" }}
                >
                  {resolveMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                  Resolve
                </button>
              </div>

              {/* Reject section */}
              <div className="flex flex-col gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#ef4444" }}>
                  Reject Dispute
                </p>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason…"
                  className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold self-start transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  {rejectMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status timeline */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <Clock size={12} />
        Last updated {new Date(dispute.updatedAt).toLocaleString()}
        {dispute.resolvedAt && (
          <> · Resolved {new Date(dispute.resolvedAt).toLocaleString()}</>
        )}
      </div>
    </div>
  );
}
