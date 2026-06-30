"use client";

import { useState } from "react";
import {
  Upload,
  Download,
  Link2,
  Pin,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useIPFS } from "@/hooks/useIPFS";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketIPFSPanelProps {
  marketData?: Record<string, unknown>;
  onUploadComplete?: (hash: string, url: string) => void;
}

// ─── MarketIPFSPanel ──────────────────────────────────────────────────────────

export default function MarketIPFSPanel({
  marketData,
  onUploadComplete,
}: MarketIPFSPanelProps) {
  const toast = useToast();
  const { status, hash, gatewayUrl, storageStatus, error, uploadJSON, retrieve, pin } =
    useIPFS();
  const [retrieveHash, setRetrieveHash] = useState("");
  const [retrievedData, setRetrievedData] = useState<unknown>(null);

  const handleUpload = async () => {
    const data = marketData ?? {
      title: "Sample Market",
      description: "Market metadata stored on IPFS",
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await uploadJSON(data, { name: "GateDelay-Market-Metadata" });
      toast.success("Stored on IPFS", `Hash: ${result.hash.slice(0, 16)}…`);
      onUploadComplete?.(result.hash, result.url);
    } catch {
      toast.error("Upload Failed", error || "Could not store on IPFS");
    }
  };

  const handleRetrieve = async () => {
    if (!retrieveHash.trim()) return;
    try {
      const data = await retrieve(retrieveHash.trim());
      setRetrievedData(data);
      toast.success("Retrieved", "Market data loaded from IPFS");
    } catch {
      toast.error("Retrieval Failed", error || "Could not retrieve from IPFS");
    }
  };

  const handlePin = async () => {
    if (!hash) return;
    try {
      await pin(hash, "GateDelay-Market-Pin");
      toast.success("Pinned", "Hash pinned successfully");
    } catch {
      toast.error("Pin Failed", error || "Could not pin hash");
    }
  };

  const STATUS_LABELS = {
    idle: "Ready",
    uploading: "Uploading…",
    stored: "Stored",
    retrieving: "Retrieving…",
    error: "Error",
  };

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-purple-500" />
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          IPFS Market Storage
        </h3>
        <span
          className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background:
              status === "stored"
                ? "rgba(34, 197, 94, 0.12)"
                : status === "error"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(107, 114, 128, 0.12)",
            color: status === "stored" ? "#22c55e" : status === "error" ? "#ef4444" : "var(--muted)",
          }}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Upload */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={status === "uploading"}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {status === "uploading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        Store Market Data on IPFS
      </button>

      {/* Current hash & link */}
      {hash && gatewayUrl && (
        <div className="space-y-2 p-3 rounded-xl" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span style={{ color: "var(--muted)" }}>IPFS Hash:</span>
            <span className="font-mono truncate" style={{ color: "var(--foreground)" }}>
              {hash}
            </span>
          </div>
          <a
            href={gatewayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-purple-500 hover:underline truncate"
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            {gatewayUrl}
          </a>
          {storageStatus && (
            <div className="flex gap-3 text-xs" style={{ color: "var(--muted)" }}>
              <span>{storageStatus.stored ? "✓ Stored" : "○ Not stored"}</span>
              <span>{storageStatus.pinned ? "✓ Pinned" : "○ Not pinned"}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handlePin}
            className="flex items-center gap-1 text-xs font-medium text-purple-500 hover:text-purple-600"
          >
            <Pin className="w-3.5 h-3.5" /> Pin Hash
          </button>
        </div>
      )}

      {/* Retrieve */}
      <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Retrieve from IPFS
        </p>
        <div className="flex gap-2">
          <input
            value={retrieveHash}
            onChange={(e) => setRetrieveHash(e.target.value)}
            placeholder="Enter IPFS hash (Qm…)"
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          <button
            type="button"
            onClick={handleRetrieve}
            disabled={status === "retrieving" || !retrieveHash.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {status === "retrieving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
        {retrievedData !== null && (
          <pre
            className="text-xs p-3 rounded-lg overflow-auto max-h-32"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          >
            {JSON.stringify(retrievedData, null, 2)}
          </pre>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.08)", color: "#ef4444" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
