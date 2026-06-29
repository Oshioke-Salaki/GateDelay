"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface FavoritedMarket {
  id: string;
  title: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  status: "open" | "closed" | "resolved" | "disputed";
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [markets, setMarkets] = useState<FavoritedMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from localStorage
  useEffect(() => {
    const storedFavorites = JSON.parse(localStorage.getItem("market_favorites") || "[]");
    setFavorites(storedFavorites);
    setIsLoading(false);
  }, []);

  // Simulate fetching market data for favorites
  useEffect(() => {
    if (favorites.length === 0) {
      setMarkets([]);
      return;
    }

    // In a real app, this would fetch from an API
    const mockMarkets: FavoritedMarket[] = favorites.map((id, index) => ({
      id,
      title: `Flight ${id.slice(0, 3).toUpperCase()} - On Time Delivery`,
      description: `Market for flight ${id} arriving on schedule`,
      yesPrice: 0.5 + Math.random() * 0.3,
      noPrice: 0.5 - Math.random() * 0.3,
      volume: Math.floor(Math.random() * 50000) + 10000,
      liquidity: Math.floor(Math.random() * 100000) + 50000,
      status: (["open", "closed", "resolved", "disputed"] as const)[index % 4],
    }));

    setMarkets(mockMarkets);
  }, [favorites]);

  const handleRemoveFavorite = (marketId: string) => {
    const updated = favorites.filter((id) => id !== marketId);
    localStorage.setItem("market_favorites", JSON.stringify(updated));
    setFavorites(updated);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p style={{ color: "var(--muted)" }}>Loading favorites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Favorite Markets
          </h1>
          <p style={{ color: "var(--muted)" }}>
            {favorites.length === 0
              ? "You haven't favorited any markets yet"
              : `You have ${favorites.length} favorite market${favorites.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Empty State */}
        {favorites.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-4xl mb-4">⭐</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              No Favorites Yet
            </h2>
            <p className="mb-6" style={{ color: "var(--muted)" }}>
              Start favoriting markets to keep track of your favorite trading opportunities.
            </p>
            <Link
              href="/markets"
              className="inline-block px-6 py-2 rounded-lg font-semibold transition-all"
              style={{
                background: "#3b82f6",
                color: "white",
              }}
            >
              Browse Markets
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <div
                key={market.id}
                className="rounded-xl overflow-hidden transition-all hover:shadow-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="p-4 space-y-3">
                  {/* Header with Remove Button */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm line-clamp-2" style={{ color: "var(--foreground)" }}>
                        {market.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleRemoveFavorite(market.id)}
                      className="shrink-0 p-1.5 rounded-lg transition-all"
                      style={{
                        background: "#ef444418",
                        color: "#ef4444",
                        border: "1px solid #ef444444",
                      }}
                      aria-label="Remove from favorites"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs line-clamp-2" style={{ color: "var(--muted)" }}>
                    {market.description}
                  </p>

                  {/* Status Badge */}
                  <div>
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-semibold"
                      style={{
                        background:
                          market.status === "open"
                            ? "#22c55e18"
                            : market.status === "closed"
                              ? "#f59e0b18"
                              : market.status === "resolved"
                                ? "#6366f118"
                                : "#ef444418",
                        color:
                          market.status === "open"
                            ? "#22c55e"
                            : market.status === "closed"
                              ? "#f59e0b"
                              : market.status === "resolved"
                                ? "#6366f1"
                                : "#ef4444",
                      }}
                    >
                      {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
                    </span>
                  </div>

                  {/* Prices */}
                  <div className="flex gap-2">
                    <div
                      className="flex-1 rounded-lg px-3 py-2 text-center"
                      style={{ background: "#22c55e18", border: "1px solid #22c55e44" }}
                    >
                      <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>
                        YES
                      </p>
                      <p className="text-sm font-bold" style={{ color: "#22c55e" }}>
                        {(market.yesPrice * 100).toFixed(0)}¢
                      </p>
                    </div>
                    <div
                      className="flex-1 rounded-lg px-3 py-2 text-center"
                      style={{ background: "#ef444418", border: "1px solid #ef444444" }}
                    >
                      <p className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>
                        NO
                      </p>
                      <p className="text-sm font-bold" style={{ color: "#ef4444" }}>
                        {(market.noPrice * 100).toFixed(0)}¢
                      </p>
                    </div>
                  </div>

                  {/* Volume + Liquidity */}
                  <div className="flex justify-between text-xs pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--muted)" }}>
                      Vol <span style={{ color: "var(--foreground)" }}>${market.volume.toLocaleString()}</span>
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      Liq <span style={{ color: "var(--foreground)" }}>${market.liquidity.toLocaleString()}</span>
                    </span>
                  </div>

                  {/* Trade Button */}
                  <Link
                    href={`/markets/${market.id}`}
                    className="block w-full py-2 px-3 rounded-lg font-semibold text-center text-sm transition-all"
                    style={{
                      background: "#3b82f6",
                      color: "white",
                    }}
                  >
                    Trade
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
