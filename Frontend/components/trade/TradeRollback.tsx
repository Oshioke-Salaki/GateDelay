"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";

interface RollbackStatus {
  rollbackId: string;
  marketId: string;
  status: 'pending' | 'validating' | 'executing' | 'completed' | 'failed' | 'rejected';
  progress?: number;
  currentStep?: number;
  totalSteps?: number;
  transactionHash?: string;
  error?: string;
  reason?: string;
  initiatedBy?: string;
  completedAt?: Date;
}

interface RollbackHistoryItem {
  rollbackId: string;
  marketId: string;
  operationType: string;
  reason?: string;
  status: string;
  transactionHash?: string;
  blockNumber?: number;
  error?: string;
  initiatedBy?: string;
  completedAt?: Date;
  createdAt: Date;
}

interface TradeRollbackProps {
  isOpen: boolean;
  onClose: () => void;
  marketId?: string;
  onRollbackComplete?: () => void;
}

export default function TradeRollback({ 
  isOpen, 
  onClose, 
  marketId, 
  onRollbackComplete 
}: TradeRollbackProps) {
  const [step, setStep] = useState<'options' | 'confirm' | 'status' | 'history'>('options');
  const [operationType, setOperationType] = useState<'trade' | 'liquidity' | 'resolution' | 'market_creation'>('trade');
  const [reason, setReason] = useState('');
  const [snapshotBlock, setSnapshotBlock] = useState<string>('');
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [status, setStatus] = useState<RollbackStatus | null>(null);
  const [history, setHistory] = useState<RollbackHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Fetch history when component mounts or marketId changes
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, marketId]);

  // Poll status when we have a rollbackId
  useEffect(() => {
    if (rollbackId && (status?.status === 'pending' || status?.status === 'executing' || status?.status === 'validating')) {
      const interval = setInterval(() => {
        fetchStatus(rollbackId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [rollbackId, status?.status]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (marketId) params.append('marketId', marketId);
      const response = await fetch(`/api/rollback/history?${params}`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch rollback history:', err);
    }
  };

  const fetchStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/rollback/status/${id}`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          fetchHistory();
        }
      }
    } catch (err) {
      console.error('Failed to fetch rollback status:', err);
    }
  };

  const validateRollback = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rollback/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          operationType,
          snapshotBlock: snapshotBlock ? parseInt(snapshotBlock, 10) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.data.valid) {
        setStep('confirm');
      } else {
        setError(data.error || data.data?.reason || 'Validation failed');
        showToast('Rollback validation failed', 'error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const requestRollback = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rollback/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          operationType,
          reason,
          initiatedBy: 'user',
          snapshotBlock: snapshotBlock ? parseInt(snapshotBlock, 10) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setRollbackId(data.data.rollbackId);
        setStatus({
          rollbackId: data.data.rollbackId,
          marketId: marketId || '',
          status: 'pending',
        });
        setStep('status');
        showToast('Rollback requested successfully', 'success');
      } else {
        setError(data.error || 'Failed to request rollback');
        showToast('Failed to request rollback', 'error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request rollback');
    } finally {
      setLoading(false);
    }
  };

  const executeRollback = async () => {
    if (!rollbackId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rollback/execute/${rollbackId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
        showToast('Rollback executed successfully', 'success');
        if (onRollbackComplete) onRollbackComplete();
      } else {
        setError(data.error || 'Failed to execute rollback');
        showToast('Failed to execute rollback', 'error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute rollback');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('options');
    setOperationType('trade');
    setReason('');
    setSnapshotBlock('');
    setRollbackId(null);
    setStatus(null);
    setError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'failed':
      case 'rejected': return '#ef4444';
      case 'executing':
      case 'validating': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rollback-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase font-semibold tracking-[0.24em]" style={{ color: "#7c3aed" }}>
                  Trade Rollback
                </p>
                <h2 id="rollback-title" className="mt-2 text-xl font-semibold">
                  {step === 'options' && 'Select Rollback Options'}
                  {step === 'confirm' && 'Confirm Rollback'}
                  {step === 'status' && 'Rollback Status'}
                  {step === 'history' && 'Rollback History'}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close rollback"
                className="rounded-full p-2 transition-opacity hover:opacity-80"
                style={{ color: "var(--muted)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-2xl border border-red-300/50 bg-red-50 p-4 text-sm" style={{ borderColor: "#fca5a5" }}>
                <p className="font-semibold text-red-800">Error</p>
                <p className="mt-1" style={{ color: "#991b1b" }}>{error}</p>
              </div>
            )}

            {/* Options Step */}
            {step === 'options' && (
              <div className="space-y-4">
                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Operation Type
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(['trade', 'liquidity', 'resolution', 'market_creation'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setOperationType(type)}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                              operationType === type 
                                ? 'bg-purple-600 text-white border-purple-600' 
                                : 'border-[var(--border)] hover:bg-[var(--background)]'
                            }`}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Reason (Optional)
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Describe why this rollback is needed..."
                        className="mt-2 w-full rounded-xl border p-3 text-sm resize-none"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--background)",
                          color: "var(--foreground)",
                          minHeight: '80px',
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Snapshot Block (Optional)
                      </label>
                      <input
                        type="number"
                        value={snapshotBlock}
                        onChange={(e) => setSnapshotBlock(e.target.value)}
                        placeholder="Block number to roll back to"
                        className="mt-2 w-full rounded-xl border p-3 text-sm"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--background)",
                          color: "var(--foreground)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('history')}
                    className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-[var(--background)]"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  >
                    View History
                  </button>
                  <button
                    onClick={validateRollback}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Validating...' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Step */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Operation Type
                      </span>
                      <span className="font-semibold">{operationType.charAt(0).toUpperCase() + operationType.slice(1).replace('_', ' ')}</span>
                    </div>
                    {marketId && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Market ID
                        </span>
                        <span className="font-semibold font-mono">{marketId}</span>
                      </div>
                    )}
                    {reason && (
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Reason
                        </span>
                        <span className="font-semibold max-w-[60%] text-right">{reason}</span>
                      </div>
                    )}
                    {snapshotBlock && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Snapshot Block
                        </span>
                        <span className="font-semibold">{snapshotBlock}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-amber-300/50 bg-amber-50 p-4 text-sm" style={{ borderColor: "#fde68a" }}>
                  <p className="font-semibold text-amber-800">Warning</p>
                  <p className="mt-2" style={{ color: "#92400e" }}>
                    This action will roll back the selected operation. This may affect user balances and positions. Please confirm you want to proceed.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setStep('options')}
                    className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/80"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={requestRollback}
                    disabled={loading}
                    className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Requesting...' : 'Request Rollback'}
                  </button>
                </div>
              </div>
            )}

            {/* Status Step */}
            {step === 'status' && status && (
              <div className="space-y-4">
                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Rollback ID
                      </span>
                      <span className="font-semibold font-mono">{status.rollbackId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Status
                      </span>
                      <span className="font-semibold px-3 py-1 rounded-full text-xs" style={{ background: getStatusColor(status.status) + '20', color: getStatusColor(status.status) }}>
                        {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                      </span>
                    </div>
                    {status.progress !== undefined && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                            Progress
                          </span>
                          <span className="font-semibold">{status.progress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ background: 'var(--border)' }}>
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${status.progress}%`,
                              background: getStatusColor(status.status),
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {status.currentStep !== undefined && status.totalSteps !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Step
                        </span>
                        <span className="font-semibold">{status.currentStep} of {status.totalSteps}</span>
                      </div>
                    )}
                    {status.transactionHash && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Transaction Hash
                        </span>
                        <span className="font-semibold font-mono text-xs truncate max-w-[60%]">{status.transactionHash}</span>
                      </div>
                    )}
                    {status.error && (
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Error
                        </span>
                        <span className="font-semibold text-red-600 max-w-[60%] text-right">{status.error}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  {status.status === 'pending' && (
                    <button
                      type="button"
                      onClick={executeRollback}
                      disabled={loading}
                      className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                    >
                      {loading ? 'Executing...' : 'Execute Rollback'}
                    </button>
                  )}
                  {(status.status === 'completed' || status.status === 'failed' || status.status === 'rejected') && (
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                    >
                      New Rollback
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep('history')}
                    className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/80"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    View History
                  </button>
                </div>
              </div>
            )}

            {/* History Step */}
            {step === 'history' && (
              <div className="space-y-4">
                <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  {history.length === 0 ? (
                    <p className="text-center py-8" style={{ color: "var(--muted)" }}>
                      No rollback history found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((item) => (
                        <div 
                          key={item.rollbackId} 
                          className="border-b last:border-b-0 pb-3 last:pb-0"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold font-mono text-xs">{item.rollbackId}</span>
                            <span className="font-semibold px-2 py-1 rounded-full text-xs" style={{ background: getStatusColor(item.status) + '20', color: getStatusColor(item.status) }}>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--muted)" }}>
                            <div>
                              <span className="font-medium">Type:</span> {item.operationType.replace('_', ' ')}
                            </div>
                            <div>
                              <span className="font-medium">Market:</span> {item.marketId}
                            </div>
                            {item.transactionHash && (
                              <div className="col-span-2 truncate">
                                <span className="font-medium">Tx:</span> {item.transactionHash}
                              </div>
                            )}
                            {item.error && (
                              <div className="col-span-2 text-red-600">
                                <span className="font-medium">Error:</span> {item.error}
                              </div>
                            )}
                            <div className="col-span-2">
                              <span className="font-medium">Created:</span> {new Date(item.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setStep('options')}
                    className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/80"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    New Rollback
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
