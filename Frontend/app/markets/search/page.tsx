"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketSearch, { Market } from "../../components/search/MarketSearch";
import { MarketListSkeleton } from "../../components/ui/Skeleton";

// Mock markets data - replace with API call
const MOCK_MARKETS: Market[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description:
      "American Airlines flight AA123 from JFK to LAX on Apr 25, 2026.",
    category: "flight",
    status: "open",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 14820,
    liquidity: 5400,
    participants: 87,
    createdAt: "2026-04-20T10:00:00Z",
  },
  {
    id: "2",
    title: "Will UA456 be delayed > 30 min?",
    description:
      "United Airlines flight UA456 from ORD to SFO on Apr 25, 2026.",
    category: "flight",
    status: "open",
    yesPrice: 0.41,
    noPrice: 0.59,
    volume: 8300,
    liquidity: 3200,
    participants: 45,
    createdAt: "2026-04-21T14:30:00Z",
  },
  {
    id: "3",
    title: "Will DL789 be cancelled?",
    description: "Delta Airlines flight DL789 from ATL to MIA on Apr 25, 2026.",
    category: "flight",
    status: "open",
    yesPrice: 0.08,
    noPrice: 0.92,
    volume: 3200,
    liquidity: 1500,
    participants: 23,
    createdAt: "2026-04-22T09:15:00Z",
  },
  {
    id: "4",
    title: "Will Bitcoin exceed $100k by EOY?",
    description: "Bitcoin price prediction for end of year 2026.",
    category: "crypto",
    status: "open",
    yesPrice: 0.72,
    noPrice: 0.28,
    volume: 125000,
    liquidity: 45000,
    participants: 1200,
    createdAt: "2026-04-15T08:00:00Z",
  },
  {
    id: "5",
    title: "Will Ethereum outperform Bitcoin in 2026?",
    description: "Ethereum vs Bitcoin performance comparison for 2026.",
    category: "crypto",
    status: "open",
    yesPrice: 0.35,
    noPrice: 0.65,
    volume: 89000,
    liquidity: 32000,
    participants: 890,
    createdAt: "2026-04-18T12:00:00Z",
  },
  {
    id: "6",
    title: "Will the Lakers win the championship?",
    description: "NBA championship prediction for 2026 season.",
    category: "sports",
    status: "open",
    yesPrice: 0.28,
    noPrice: 0.72,
    volume: 45000,
    liquidity: 18000,
    participants: 567,
    createdAt: "2026-04-10T16:00:00Z",
  },
  {
    id: "7",
    title: "Will the Fed cut rates in Q2 2026?",
    description: "Federal Reserve interest rate decision prediction.",
    category: "other",
    status: "closed",
    yesPrice: 0.58,
    noPrice: 0.42,
    volume: 67000,
    liquidity: 25000,
    participants: 734,
    createdAt: "2026-04-05T11:00:00Z",
  },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!searchParams) return;
    // Load search params from URL if present
    if (!searchParams) return;
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    // Could apply these to initial filters here
  }, [searchParams]);

  const handleSearch = async (filters: any) => {
    setIsLoading(true);
    try {
      // Replace with actual API call
      // const response = await fetch(`/api/markets/search?${new URLSearchParams(filters)}`);
      // const data = await response.json();
      // setMarkets(data);

      // For now, just simulate delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      setMarkets(MOCK_MARKETS);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
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
        />
      </Suspense>
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
