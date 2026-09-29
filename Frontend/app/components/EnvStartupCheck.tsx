"use client";

import { useState, useEffect } from "react";
import { validateContractAddresses, type EnvValidationResult } from "@/lib/envValidation";

export function EnvStartupCheck() {
  const [result, setResult] = useState<EnvValidationResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setResult(validateContractAddresses());
  }, []);

  if (process.env.NODE_ENV !== "development") return null;
  if (!result || result.valid || dismissed) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-2 rounded-xl px-4 py-3 text-sm"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.35)",
        color: "#ef4444",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-1.5">
            ⚠ Invalid contract address configuration
          </p>
          <ul className="space-y-0.5 text-xs font-mono" style={{ color: "rgba(239,68,68,0.9)" }}>
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <p className="text-xs mt-2" style={{ color: "rgba(239,68,68,0.65)" }}>
            Fix these values in your <code>.env.local</code> file and restart the dev server.
            Each address must be <code>0x</code> followed by exactly 40 hex characters.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss env validation error"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-sm"
          style={{ color: "#ef4444" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
