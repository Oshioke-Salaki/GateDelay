"use client";
import { useState, useCallback, useMemo } from "react";
import { debounce } from "lodash";
import { ChevronDown, X, Share2, Bookmark } from "lucide-react";

export interface Market {
  id: string;
  title: string;
  description: string;
  category?: string;
  status: "open" | "closed" | "resolved" | "disputed";
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  participants?: number;
  createdAt?: string;
}

interface SearchFilters {
  query: string;
  category?: string;
  status?: string;
  minVolume?: number;
  maxVolume?: number;
  minLiquidity?: number;
  sortBy: "relevance" | "volume" | "date" | "liquidity";
}

interface MarketSearchProps {
  markets: Market[];
  onSearch?: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

export default function MarketSearch({
  markets,
  onSearch,
  isLoading = false,
}: MarketSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    sortBy: "relevance",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SearchFilters[]>([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);

  // Debounced search callback
  const debouncedSearch = useMemo(
    () =>
      debounce((newFilters: SearchFilters) => {
        onSearch?.(newFilters);
      }, 300),
    [onSearch],
  );

  const handleQueryChange = (query: string) => {
    const newFilters = { ...filters, query };
    setFilters(newFilters);
    debouncedSearch(newFilters);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onSearch?.(newFilters);
  };

  const handleClearFilters = () => {
    const cleared = { query: "", sortBy: "relevance" as const };
    setFilters(cleared);
    onSearch?.(cleared);
  };

  const handleSaveSearch = () => {
    if (filters.query.trim()) {
      setSavedSearches([...savedSearches, filters]);
    }
  };

  const handleLoadSearch = (search: SearchFilters) => {
    setFilters(search);
    onSearch?.(search);
    setShowSavedSearches(false);
  };

  const handleDeleteSavedSearch = (index: number) => {
    setSavedSearches(savedSearches.filter((_, i) => i !== index));
  };

  const handleShareSearch = () => {
    const query = new URLSearchParams();
    if (filters.query) query.set("q", filters.query);
    if (filters.category) query.set("category", filters.category);
    if (filters.status) query.set("status", filters.status);
    if (filters.minVolume) query.set("minVolume", filters.minVolume.toString());
    if (filters.maxVolume) query.set("maxVolume", filters.maxVolume.toString());
    if (filters.sortBy) query.set("sort", filters.sortBy);

    const url = `${window.location.origin}${window.location.pathname}?${query.toString()}`;
    navigator.clipboard.writeText(url);
    alert("Search URL copied to clipboard!");
  };

  const filteredMarkets = useMemo(() => {
    let results = [...markets];

    // Text search
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q),
      );
    }

    // Category filter
    if (filters.category) {
      results = results.filter((m) => m.category === filters.category);
    }

    // Status filter
    if (filters.status) {
      results = results.filter((m) => m.status === filters.status);
    }

    // Volume filters
    if (filters.minVolume !== undefined) {
      results = results.filter((m) => m.volume >= filters.minVolume!);
    }
    if (filters.maxVolume !== undefined) {
      results = results.filter((m) => m.volume <= filters.maxVolume!);
    }

    // Liquidity filter
    if (filters.minLiquidity !== undefined) {
      results = results.filter((m) => m.liquidity >= filters.minLiquidity!);
    }

    // Sorting
    switch (filters.sortBy) {
      case "volume":
        results.sort((a, b) => b.volume - a.volume);
        break;
      case "date":
        results.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        break;
      case "liquidity":
        results.sort((a, b) => b.liquidity - a.liquidity);
        break;
      case "relevance":
      default:
        if (filters.query) {
          results.sort((a, b) => {
            const aMatch = a.title
              .toLowerCase()
              .indexOf(filters.query.toLowerCase());
            const bMatch = b.title
              .toLowerCase()
              .indexOf(filters.query.toLowerCase());
            return aMatch - bMatch;
          });
        }
    }

    return results;
  }, [markets, filters]);

  const hasActiveFilters =
    filters.query ||
    filters.category ||
    filters.status ||
    filters.minVolume ||
    filters.maxVolume ||
    filters.minLiquidity;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search markets by title or description..."
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 rounded-lg border transition-colors hover:opacity-80 flex items-center gap-2"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <ChevronDown size={18} />
          Filters
        </button>
        <button
          onClick={() => setShowSavedSearches(!showSavedSearches)}
          className="px-4 py-2 rounded-lg border transition-colors hover:opacity-80"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <Bookmark size={18} />
        </button>
      </div>

      {/* Saved Searches Dropdown */}
      {showSavedSearches && savedSearches.length > 0 && (
        <div
          className="p-3 rounded-lg border space-y-2"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--muted)" }}
          >
            SAVED SEARCHES
          </p>
          {savedSearches.map((search, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded hover:opacity-80 cursor-pointer"
              style={{ background: "var(--background)" }}
              onClick={() => handleLoadSearch(search)}
            >
              <span className="text-sm" style={{ color: "var(--foreground)" }}>
                {search.query || "All Markets"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSavedSearch(idx);
                }}
                className="p-1 hover:opacity-60"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div
          className="p-4 rounded-lg border space-y-4"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                CATEGORY
              </label>
              <select
                value={filters.category || ""}
                onChange={(e) =>
                  handleFilterChange("category", e.target.value || undefined)
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="">All Categories</option>
                <option value="flight">Flight</option>
                <option value="sports">Sports</option>
                <option value="politics">Politics</option>
                <option value="crypto">Crypto</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                STATUS
              </label>
              <select
                value={filters.status || ""}
                onChange={(e) =>
                  handleFilterChange("status", e.target.value || undefined)
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="resolved">Resolved</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                SORT BY
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  handleFilterChange(
                    "sortBy",
                    e.target.value as SearchFilters["sortBy"],
                  )
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="relevance">Relevance</option>
                <option value="volume">Volume</option>
                <option value="liquidity">Liquidity</option>
                <option value="date">Date</option>
              </select>
            </div>

            {/* Min Volume */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                MIN VOLUME
              </label>
              <input
                type="number"
                placeholder="0"
                value={filters.minVolume || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "minVolume",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            {/* Max Volume */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                MAX VOLUME
              </label>
              <input
                type="number"
                placeholder="∞"
                value={filters.maxVolume || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "maxVolume",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            {/* Min Liquidity */}
            <div>
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                MIN LIQUIDITY
              </label>
              <input
                type="number"
                placeholder="0"
                value={filters.minLiquidity || ""}
                onChange={(e) =>
                  handleFilterChange(
                    "minLiquidity",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{
                  background: "var(--background)",
                  color: "var(--muted)",
                }}
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={handleSaveSearch}
              className="px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80 flex items-center gap-1"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            >
              <Bookmark size={14} />
              Save Search
            </button>
            <button
              onClick={handleShareSearch}
              className="px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80 flex items-center gap-1"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            >
              <Share2 size={14} />
              Share
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {isLoading ? "Searching..." : `${filteredMarkets.length} results`}
          </p>
        </div>

        {filteredMarkets.length === 0 ? (
          <div
            className="p-8 rounded-lg text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ color: "var(--muted)" }}>No markets found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                className="p-4 rounded-lg border transition-opacity hover:opacity-80"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {market.title}
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--muted)" }}
                    >
                      {market.description}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span style={{ color: "var(--muted)" }}>
                        Vol: ${market.volume.toLocaleString()}
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        Liq: ${market.liquidity.toLocaleString()}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded"
                        style={{
                          background:
                            market.status === "open"
                              ? "rgba(34, 197, 94, 0.1)"
                              : "rgba(107, 114, 128, 0.1)",
                          color:
                            market.status === "open"
                              ? "#22c55e"
                              : "var(--muted)",
                        }}
                      >
                        {market.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#22c55e" }}
                    >
                      YES {(market.yesPrice * 100).toFixed(0)}¢
                    </p>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#ef4444" }}
                    >
                      NO {(market.noPrice * 100).toFixed(0)}¢
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
