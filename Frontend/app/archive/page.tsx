"use client";
import { useState, useEffect, useCallback } from "react";
import ArchiveView from "@/components/archive/ArchiveView";
import { MarketListSkeleton } from "@/app/components/ui/Skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ArchivedMarket {
  id: string;
  title: string;
  description: string;
  category: string;
  resolvedOutcome: "yes" | "no" | "cancelled";
  resolutionDate: string;
  volume: number;
  participants: number;
  createdAt: string;
  endDate: string;
  finalPrice: number;
}

export default function ArchivePage() {
  const [markets, setMarkets] = useState<ArchivedMarket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/archive");
      if (!response.ok) {
        throw new Error(`Failed to fetch archive data (${response.status})`);
      }
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load archived markets";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6" data-testid="archive-page">
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Market Archive
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Browse resolved and inactive markets with performance statistics
        </p>
      </div>

      {isLoading ? (
        <div data-testid="archive-loading">
          <MarketListSkeleton count={5} />
        </div>
      ) : error ? (
        <div
          data-testid="archive-error-container"
          className="rounded-lg p-6 space-y-4 text-center"
          style={{
            background: "var(--card)",
            border: "1px solid #ef4444",
          }}
        >
          <div className="flex items-center justify-center gap-2 text-red-500">
            <AlertCircle size={24} />
            <span className="font-semibold text-base">Error Loading Archive</span>
          </div>
          <p
            data-testid="archive-error-message"
            className="text-sm"
            style={{ color: "var(--muted)" }}
          >
            {error}
          </p>
          <div>
            <button
              data-testid="archive-retry-button"
              onClick={fetchMarkets}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} />
              Retry Loading
            </button>
          </div>
        </div>
      ) : (
        <ArchiveView markets={markets} />
      )}
    </main>
  );
}
