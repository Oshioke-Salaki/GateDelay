"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "react-modal";
import {
  CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronUp,
  ShieldCheck, AlertCircle, ArrowRight, History, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowStatus = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "EXPIRED";
export type StageStatus   = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "EXPIRED" | "DELEGATED";

export interface ApprovalDecision {
  approverId: string;
  role: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string | null;
  timestamp: string;
}

export interface WorkflowStage {
  name: string;
  label: string;
  order: number;
  status: StageStatus;
  requiredApprovers: number;
  approvals: ApprovalDecision[];
  rejections: ApprovalDecision[];
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  automated: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  tradeId: string;
  userId: string;
  tradeData: {
    pair: string;
    amount: string;
    price: string;
    side: string;
    type: string;
  };
  status: WorkflowStatus;
  currentStage: string | null;
  stages: WorkflowStage[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface ApprovalFlowProps {
  tradeId: string;
  userId: string;
  tradeData?: ApprovalWorkflow["tradeData"];
  /** Approver identity — if provided, shows approve/reject controls */
  approverId?: string;
  approverRole?: string;
  onApproved?: (workflow: ApprovalWorkflow) => void;
  onRejected?: (workflow: ApprovalWorkflow) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, {
  label: string; color: string; bg: string; Icon: React.ElementType;
}> = {
  PENDING:     { label: "Pending",     color: "#f59e0b", bg: "#f59e0b15", Icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "#3b82f6", bg: "#3b82f615", Icon: Loader2 },
  APPROVED:    { label: "Approved",    color: "#22c55e", bg: "#22c55e15", Icon: CheckCircle },
  REJECTED:    { label: "Rejected",    color: "#ef4444", bg: "#ef444415", Icon: XCircle },
  EXPIRED:     { label: "Expired",     color: "#71717a", bg: "#71717a15", Icon: AlertCircle },
};

const STAGE_STATUS_CONFIG: Record<StageStatus, { color: string; Icon: React.ElementType }> = {
  PENDING:     { color: "var(--muted)", Icon: Clock },
  IN_PROGRESS: { color: "#3b82f6",     Icon: Loader2 },
  APPROVED:    { color: "#22c55e",     Icon: CheckCircle },
  REJECTED:    { color: "#ef4444",     Icon: XCircle },
  EXPIRED:     { color: "#71717a",     Icon: AlertCircle },
  DELEGATED:   { color: "#a855f7",     Icon: ArrowRight },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchWorkflowByTrade(tradeId: string): Promise<ApprovalWorkflow[]> {
  const res = await fetch(`/api/approvals/trade/${tradeId}`);
  if (!res.ok) throw new Error("Failed to load workflows");
  const data = await res.json();
  return data.data?.workflows ?? [];
}

async function fetchWorkflow(workflowId: string): Promise<ApprovalWorkflow> {
  const res = await fetch(`/api/approvals/${workflowId}`);
  if (!res.ok) throw new Error("Failed to load workflow");
  return (await res.json()).data;
}

async function createWorkflowApi(payload: {
  tradeId: string; userId: string; tradeData: ApprovalWorkflow["tradeData"];
}): Promise<ApprovalWorkflow> {
  const res = await fetch("/api/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": payload.userId },
    body: JSON.stringify({ tradeId: payload.tradeId, tradeData: payload.tradeData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create workflow");
  }
  return (await res.json()).data;
}

async function submitDecisionApi(payload: {
  workflowId: string; approverId: string; role: string;
  decision: "APPROVED" | "REJECTED"; notes?: string;
}): Promise<{ workflowStatus: WorkflowStatus; stageStatus: StageStatus }> {
  const res = await fetch(`/api/approvals/${payload.workflowId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-approver-id": payload.approverId,
      "x-approver-role": payload.role,
    },
    body: JSON.stringify({ decision: payload.decision, notes: payload.notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to submit decision");
  }
  return (await res.json()).data;
}

async function fetchHistory(userId: string, limit = 10): Promise<ApprovalWorkflow[]> {
  const res = await fetch(`/api/approvals/history?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load history");
  return (await res.json()).data?.workflows ?? [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const cfg = WORKFLOW_STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <cfg.Icon size={11} className={status === "IN_PROGRESS" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

function StageStep({ stage, isCurrent }: { stage: WorkflowStage; isCurrent: boolean }) {
  const [open, setOpen] = useState(isCurrent);
  const cfg = STAGE_STATUS_CONFIG[stage.status];

  const progressPct = stage.requiredApprovers > 0
    ? Math.round((stage.approvals.length / stage.requiredApprovers) * 100)
    : 0;

  const expiresIn = stage.expiresAt
    ? Math.max(0, Math.round((new Date(stage.expiresAt).getTime() - Date.now()) / 1000))
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "var(--card)",
        border: `1px solid ${isCurrent ? cfg.color + "66" : "var(--border)"}`,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <cfg.Icon
            size={16}
            style={{ color: cfg.color, flexShrink: 0 }}
            className={stage.status === "IN_PROGRESS" ? "animate-pulse" : ""}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {stage.label}
              {stage.automated && (
                <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full"
                  style={{ background: "#3b82f620", color: "#3b82f6" }}>
                  Auto
                </span>
              )}
            </p>
            {stage.status === "IN_PROGRESS" && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {stage.approvals.length}/{stage.requiredApprovers} approvals
                {expiresIn !== null && expiresIn > 0 && (
                  <> · expires in {expiresIn < 60 ? `${expiresIn}s` : `${Math.round(expiresIn / 60)}m`}</>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium" style={{ color: cfg.color }}>
            {stage.status}
          </span>
          {open ? <ChevronUp size={14} style={{ color: "var(--muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--muted)" }} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          {stage.status === "IN_PROGRESS" && stage.requiredApprovers > 1 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted)" }}>
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: "#3b82f6" }}
                />
              </div>
            </div>
          )}

          {stage.approvals.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>Approvals</p>
              {stage.approvals.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <CheckCircle size={11} style={{ color: "#22c55e" }} />
                  <span style={{ color: "var(--foreground)" }}>{a.approverId}</span>
                  <span style={{ color: "var(--muted)" }}>({a.role})</span>
                  {a.notes && <span style={{ color: "var(--muted)" }}>· {a.notes}</span>}
                </div>
              ))}
            </div>
          )}

          {stage.rejections.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-medium mb-1" style={{ color: "#ef4444" }}>Rejections</p>
              {stage.rejections.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <XCircle size={11} style={{ color: "#ef4444" }} />
                  <span style={{ color: "var(--foreground)" }}>{r.approverId}</span>
                  {r.notes && <span style={{ color: "var(--muted)" }}>· {r.notes}</span>}
                </div>
              ))}
            </div>
          )}

          {stage.completedAt && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Completed {new Date(stage.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApprovalFlow({
  tradeId, userId, tradeData, approverId, approverRole, onApproved, onRejected,
}: ApprovalFlowProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showHistory, setShowHistory] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{
    workflowId: string; decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [notes, setNotes] = useState("");

  // Auto-refresh for in-progress workflows
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queryKey = ["approvals", "trade", tradeId];
  const historyKey = ["approvals", "history", userId];

  // ─── Query: workflows for this trade ──────────────────────────────────────

  const {
    data: workflows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ApprovalWorkflow[]>({
    queryKey,
    queryFn: () => fetchWorkflowByTrade(tradeId),
    staleTime: 10_000,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // ─── Query: approval history ───────────────────────────────────────────────

  const { data: history = [] } = useQuery<ApprovalWorkflow[]>({
    queryKey: historyKey,
    queryFn: () => fetchHistory(userId),
    enabled: showHistory,
    staleTime: 30_000,
  });

  // Stop auto-refresh when all workflows terminal
  useEffect(() => {
    const allTerminal = workflows.every((w) =>
      ["APPROVED", "REJECTED", "EXPIRED"].includes(w.status)
    );
    if (allTerminal && workflows.length > 0) setAutoRefresh(false);
  }, [workflows]);

  // ─── Mutation: create workflow ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () => createWorkflowApi({ tradeId, userId, tradeData: tradeData! }),
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey });
      toast.info("Approval workflow started", `${wf.stages.length} stages required`);
      setAutoRefresh(true);
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  // ─── Mutation: submit decision ─────────────────────────────────────────────

  const decisionMutation = useMutation({
    mutationFn: (payload: { workflowId: string; decision: "APPROVED" | "REJECTED" }) =>
      submitDecisionApi({
        workflowId: payload.workflowId,
        approverId: approverId!,
        role: approverRole!,
        decision: payload.decision,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async (result, vars) => {
      setDecisionModal(null);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: historyKey });

      const wfs = await fetchWorkflowByTrade(tradeId);
      const updated = wfs.find((w) => w.id === vars.workflowId);

      if (result.workflowStatus === "APPROVED") {
        toast.success("Trade approved", "All approval stages passed.");
        if (updated) onApproved?.(updated);
      } else if (result.workflowStatus === "REJECTED") {
        toast.error("Trade rejected", "The approval workflow was rejected.");
        if (updated) onRejected?.(updated);
      } else {
        toast.success("Decision recorded", `Stage ${vars.decision.toLowerCase()}.`);
      }
    },
    onError: (err: Error) => toast.error("Failed", err.message),
  });

  // ─── Active workflow ───────────────────────────────────────────────────────

  const activeWorkflow = workflows.find(
    (w) => !["APPROVED", "REJECTED", "EXPIRED"].includes(w.status)
  ) ?? workflows[0];

  const canApprove =
    !!approverId &&
    !!approverRole &&
    activeWorkflow?.status === "IN_PROGRESS" &&
    !activeWorkflow?.stages.find((s) => s.name === activeWorkflow.currentStage)?.automated;

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--muted)" }}>
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading approval status…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "#ef4444" }}>
        <AlertCircle size={16} />
        <span className="text-sm">Failed to load approval data</span>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: "#3b82f6" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            Approval Flow
          </h2>
          {activeWorkflow && <WorkflowBadge status={activeWorkflow.status} />}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAutoRefresh(true); refetch(); }}
            className="p-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
            aria-label="Refresh approval status"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
            aria-expanded={showHistory}
          >
            <History size={13} />
            History
          </button>
        </div>
      </div>

      {/* No workflow yet */}
      {workflows.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-8 px-4 rounded-xl text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <ShieldCheck size={32} style={{ color: "var(--muted)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              No approval workflow yet
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Start an approval workflow to get this trade reviewed
            </p>
          </div>
          {tradeData && (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#3b82f6", color: "#fff" }}
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Start Approval
            </button>
          )}
        </div>
      )}

      {/* Active workflow */}
      {activeWorkflow && (
        <div className="flex flex-col gap-3">
          {/* Trade info */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 rounded-xl text-xs"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {[
              ["Trade ID", activeWorkflow.tradeId.slice(0, 16) + "…"],
              ["Pair",   activeWorkflow.tradeData.pair],
              ["Side",   activeWorkflow.tradeData.side],
              ["Amount", activeWorkflow.tradeData.amount],
            ].map(([k, v]) => (
              <div key={k}>
                <p style={{ color: "var(--muted)" }}>{k}</p>
                <p className="font-semibold" style={{ color: "var(--foreground)" }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Stage pipeline */}
          <div className="flex flex-col gap-2">
            {activeWorkflow.stages
              .sort((a, b) => a.order - b.order)
              .map((stage) => (
                <StageStep
                  key={stage.name}
                  stage={stage}
                  isCurrent={stage.name === activeWorkflow.currentStage}
                />
              ))}
          </div>

          {/* Approve / Reject controls */}
          {canApprove && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDecisionModal({ workflowId: activeWorkflow.id, decision: "APPROVED" })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e44" }}
              >
                <CheckCircle size={14} />
                Approve Stage
              </button>
              <button
                onClick={() => setDecisionModal({ workflowId: activeWorkflow.id, decision: "REJECTED" })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444444" }}
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
          )}

          {/* Error display */}
          {(activeWorkflow.status === "REJECTED" || activeWorkflow.status === "EXPIRED") && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{
                background: activeWorkflow.status === "REJECTED" ? "#ef444415" : "#71717a15",
                border: `1px solid ${activeWorkflow.status === "REJECTED" ? "#ef444444" : "#71717a44"}`,
                color: activeWorkflow.status === "REJECTED" ? "#ef4444" : "#71717a",
              }}
              role="alert"
            >
              {activeWorkflow.status === "REJECTED"
                ? <XCircle size={15} />
                : <AlertCircle size={15} />}
              <span>
                Workflow {activeWorkflow.status.toLowerCase()}.{" "}
                {activeWorkflow.completedAt && `Completed ${new Date(activeWorkflow.completedAt).toLocaleString()}`}
              </span>
            </div>
          )}

          {/* Success display */}
          {activeWorkflow.status === "APPROVED" && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#22c55e15", border: "1px solid #22c55e44", color: "#22c55e" }}
              role="status"
            >
              <CheckCircle size={15} />
              <span>
                Trade approved and ready for execution.{" "}
                {activeWorkflow.completedAt && new Date(activeWorkflow.completedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* History section */}
      {showHistory && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Recent Approvals
          </h3>
          {history.length === 0 ? (
            <div className="px-4 py-4 rounded-xl text-sm text-center"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
              No approval history
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {history.map((wf) => (
                <div key={wf.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {wf.tradeData.pair} · {wf.tradeData.side} {wf.tradeData.amount}
                    </p>
                    <p style={{ color: "var(--muted)" }}>{new Date(wf.createdAt).toLocaleDateString()}</p>
                  </div>
                  <WorkflowBadge status={wf.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision modal */}
      {decisionModal && (
        <Modal
          isOpen
          onRequestClose={() => { setDecisionModal(null); setNotes(""); }}
          contentLabel={`${decisionModal.decision === "APPROVED" ? "Approve" : "Reject"} stage`}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          className="relative w-full max-w-md mx-4 rounded-2xl p-6 outline-none flex flex-col gap-4"
          style={{ content: { background: "var(--background)", border: "1px solid var(--border)" } }}
          ariaHideApp={false}
        >
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            {decisionModal.decision === "APPROVED" ? "✅ Approve Stage" : "❌ Reject Stage"}
          </h3>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {decisionModal.decision === "APPROVED"
              ? "Confirm your approval for the current stage. This will advance the workflow."
              : "Rejecting will immediately fail the entire approval workflow."}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context or reasoning…"
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setDecisionModal(null); setNotes(""); }}
              className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => decisionMutation.mutate(decisionModal)}
              disabled={decisionMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: decisionModal.decision === "APPROVED" ? "#22c55e" : "#ef4444",
                color: "#fff",
              }}
            >
              {decisionMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              {decisionModal.decision === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
