"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Base animated skeleton block */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <motion.div
      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      className={`rounded-md ${className}`}
      style={{
        background:
          "linear-gradient(90deg, var(--card) 25%, var(--border) 50%, var(--card) 75%)",
        backgroundSize: "400% 100%",
        ...style,
      }}
    />
  );
}

/** Skeleton for a single market card row */
export function MarketCardSkeleton() {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-5 py-4"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="space-y-2 flex-1 mr-8">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <div className="space-y-2 text-right">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Skeleton for a list of market cards */
export function MarketListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a stats grid (4 cards) */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a chart area */
export function ChartSkeleton({ height = 192 }: { height?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", height }}
    >
      <Skeleton className="h-full w-full rounded-xl" />
    </div>
  );
}

/** Skeleton for a transaction table */
export function TransactionTableSkeleton({ rows = 5 }: { rows?: number }) {
  const cols = [140, 80, 160, 100, 90, 100]; // approximate col widths
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg ml-auto" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Header */}
        <div
          className="flex gap-4 px-4 py-3"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          {cols.map((w, i) => (
            <Skeleton key={i} className="h-3 rounded" style={{ width: w * 0.6 }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div
            key={ri}
            className="flex gap-4 px-4 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {cols.map((w, ci) => (
              <Skeleton key={ci} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40 rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
