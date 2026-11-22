"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketSearch, { type Market, type SearchFilters } from "../../components/search/MarketSearch";
import { MarketListSkeleton } from "../../components/ui/Skeleton";
import { searchMarkets } from "../../lib/marketApi";

const PAGE_SIZE = 10;

interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<SearchFilters>({ query: "", sortBy: "relevance" });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const runSearch = useCallback(async (filters: SearchFilters, page: number) => {
    setLastFilters(filters);
    setIsLoading(true);
    setSearchError(null);
    try {
      const result = await searchMarkets({
        query: filters.query,
        category: filters.category,
        status: filters.status,
        sortBy: filters.sortBy,
        page,
        pageSize: PAGE_SIZE,
      });
      setMarkets(result.markets);
      setPagination({
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const initialFilters: SearchFilters = {
      query: searchParams.get("q") ?? "",
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sortBy: "relevance",
    };
    void runSearch(initialFilters, 1);
    // Only run once on mount with the initial URL params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (filters: SearchFilters) => {
    await runSearch(filters, 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    void runSearch(lastFilters, nextPage);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Search Markets
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Find and filter prediction markets with advanced search options
        </p>
      </div>

      <Suspense fallback={<MarketListSkeleton count={5} />}>
        <MarketSearch
          markets={markets}
          onSearch={handleSearch}
          isLoading={isLoading}
          error={searchError}
          onRetry={() => void runSearch(lastFilters, pagination.page)}
        />
      </Suspense>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={isLoading || pagination.page <= 1}
            className="px-3 py-1.5 rounded-md text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Previous
          </button>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={isLoading || pagination.page >= pagination.totalPages}
            className="px-3 py-1.5 rounded-md text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<MarketListSkeleton count={5} />}>
      <SearchContent />
    </Suspense>
  );
}
