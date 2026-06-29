"use client";
import { useState } from "react";
import { CheckCircle, AlertCircle, ExternalLink, Shield } from "lucide-react";

export interface DIDInfo {
  did: string;
  verified: boolean;
  verificationStatus: "verified" | "pending" | "unverified";
  claims: {
    name?: string;
    email?: string;
    kyc?: boolean;
    reputation?: number;
  };
  attestations: {
    issuer: string;
    claim: string;
    date: string;
    verified: boolean;
  }[];
  verificationLinks: {
    label: string;
    url: string;
  }[];
}

interface DIDDisplayProps {
  did?: DIDInfo;
  compact?: boolean;
}

export default function DIDDisplay({ did, compact = false }: DIDDisplayProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (!did) {
    return (
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--muted)" }} className="text-sm">
          No identity information available
        </p>
      </div>
    );
  }

  const statusColor =
    did.verificationStatus === "verified"
      ? "#22c55e"
      : did.verificationStatus === "pending"
      ? "#f59e0b"
      : "#ef4444";

  const statusLabel =
    did.verificationStatus === "verified"
      ? "Verified"
      : did.verificationStatus === "pending"
      ? "Pending"
      : "Unverified";

  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Shield size={20} style={{ color: statusColor, marginTop: "2px" }} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Decentralized Identity
              </p>
              <span
                className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1"
                style={{ background: statusColor + "20", color: statusColor }}
              >
                {did.verificationStatus === "verified" && (
                  <CheckCircle size={12} />
                )}
                {did.verificationStatus === "pending" && (
                  <AlertCircle size={12} />
                )}
                {statusLabel}
              </span>
            </div>
            <p
              className="text-xs mt-1 font-mono"
              style={{ color: "var(--muted)" }}
            >
              {did.did}
            </p>
          </div>
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-2 py-1 rounded"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>

      {expanded && (
        <>
          {/* Claims */}
          {Object.keys(did.claims).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Identity Claims
              </p>
              <div className="space-y-1">
                {did.claims.name && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted)" }}>Name:</span>
                    <span style={{ color: "var(--foreground)" }}>
                      {did.claims.name}
                    </span>
                  </div>
                )}
                {did.claims.email && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted)" }}>Email:</span>
                    <span style={{ color: "var(--foreground)" }}>
                      {did.claims.email}
                    </span>
                  </div>
                )}
                {did.claims.kyc !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted)" }}>KYC:</span>
                    <span
                      style={{
                        color: did.claims.kyc ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {did.claims.kyc ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                )}
                {did.claims.reputation !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted)" }}>Reputation:</span>
                    <span style={{ color: "var(--foreground)" }}>
                      {did.claims.reputation}/100
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attestations */}
          {did.attestations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Attestations ({did.attestations.length})
              </p>
              <div className="space-y-2">
                {did.attestations.map((att, idx) => (
                  <div
                    key={idx}
                    className="rounded p-2"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                          {att.claim}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          by {att.issuer}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          {new Date(att.date).toLocaleDateString()}
                        </p>
                      </div>
                      {att.verified && (
                        <CheckCircle size={14} style={{ color: "#22c55e" }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Links */}
          {did.verificationLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Verification Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {did.verificationLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {link.label}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
