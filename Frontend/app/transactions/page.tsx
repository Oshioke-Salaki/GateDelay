"use client";

import { Suspense } from "react";
import TransactionHistory from "../components/transactions/TransactionHistory";
import { TransactionTableSkeleton } from "../components/ui/Skeleton";

export default function TransactionsPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
          Transaction History
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          All your trades, deposits, and redemptions in one place.
        </p>
      </div>

      <Suspense fallback={<TransactionTableSkeleton rows={10} />}>
        <TransactionHistory />
      </Suspense>
    </main>
  );
}
