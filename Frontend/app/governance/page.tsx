"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { Shield, Info } from "lucide-react";
import GovernanceUI from "../../components/governance/GovernanceUI";

function GovernanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Voting power skeleton */}
      <div
        className="rounded-2xl p-5 h-28"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      />
      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4 h-20"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          />
        ))}
      </div>
      {/* Proposal cards skeleton */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-5 h-44"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />
      ))}
    </div>
  );
}

export default function GovernancePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="rounded-xl p-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(102,126,234,0.2), rgba(139,92,246,0.2))",
              border: "1px solid rgba(102,126,234,0.3)",
            }}
          >
            <Shield size={20} style={{ color: "#667eea" }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Governance
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Shape the future of GateDelay. Review active proposals, check your voting power,
          and cast on-chain votes.
        </p>

        {/* Info banner */}
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(102,126,234,0.06)",
            border: "1px solid rgba(102,126,234,0.18)",
            color: "var(--muted)",
          }}
        >
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: "#667eea" }} />
          <span>
            Voting power is determined by your governance token balance plus any delegated
            tokens. Connect your wallet to participate. Votes are cast directly on the Mantle
            network.
          </span>
        </div>
      </motion.div>

      {/* Governance UI */}
      <Suspense fallback={<GovernanceSkeleton />}>
        <GovernanceUI />
      </Suspense>
    </main>
  );
}
