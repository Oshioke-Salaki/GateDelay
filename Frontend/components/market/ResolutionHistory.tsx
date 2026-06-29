"use client";

import { useState, useMemo, useCallback } from "react";

export interface ResolvedMarket {
  id: string;
  title: string;
  description: string;
  resolvedAt: Date;
  outcome: "YES" | "NO" | "INVALID";
  resolutionProof?: string;
  resolutionSource?: string;
  accuracy?: number; // 0-100
  volume: number;
  liquidity: number;
  yesPrice?: number;
  noPrice?: number;
  createdAt: Date;
}

interface ResolutionHistoryProps {
  markets: ResolvedMarket[];
  onMarketClick?: (market: ResolvedMarket) => void;
  searchable?: boolean;
  filterable?: boolean;
}

type SortField = "resolvedAt" | "accuracy" | "volume";
type SortOrder = "asc" | "desc";
type OutcomeFilter = "all" | "YES" | "NO" | "INVALID";

export default function ResolutionHistory({
  markets,
  onMarketClick,
  searchable = true,
  filterable = true,
}: ResolutionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sortField, setSortField] = useState<SortField>("resolvedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = [...markets];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term) ||
          m.id.toLowerCase().includes(term)
      );
    }

    // Outcome filter
    if (outcomeFilter !== "all") {
      result = result.filter((m) => m.outcome === outcomeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | Date;
      let bVal: number | Date;

      switch (sortField) {
        case "resolvedAt":
          aVal = a.resolvedAt;
          bVal = b.resolvedAt;
          break;
        case "accuracy":
          aVal = a.accuracy ?? 0;
          bVal = b.accuracy ?? 0;
          break;
        case "volume":
          aVal = a.volume;
          bVal = b.volume;
          break;
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [markets, searchTerm, outcomeFilter, sortField, sortOrder]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField(field);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "YES":
        return { bg: "#22c55e18", text: "#22c55e", border: "#22c55e44" };
      case "NO":
        return { bg: "#ef444418", text: "#ef4444", border: "#ef444444" };
      case "INVALID":
        return { bg: "#f59e0b18", text: "#f59e0b", border: "#f59e0b44" };
      default:
        return { bg: "var(--border)", text: "var(--muted)", border: "var(--border)" };
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Resolution History
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {filteredMarkets.length} of {markets.length} resolved markets
        </p>
      </div>

      {/* Search and Filters */}
      {(searchable || filterable) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              >
                <circle cx="6" cy="6" r="5" />
                <line x1="11" y1="11" x2="15" y2="15" />
              </svg>
            </div>
          )}

          {filterable && (
            <div className="flex gap-2">
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
                className="px-3 py-2 rounded-lg border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="all">All Outcomes</option>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
                <option value="INVALID">Invalid</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--border)" }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                Market
              </th>
              <th
                className="px-4 py-3 text-left font-semibold cursor-pointer hover:opacity-70"
                onClick={() => toggleSort("resolvedAt")}
                style={{ color: "var(--foreground)" }}
              >
                <div className="flex items-center gap-2">
                  Resolved
                  {sortField === "resolvedAt" && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      className={sortOrder === "asc" ? "rotate-180" : ""}
                    >
                      <polygon points="6,2 12,10 0,10" />
                    </svg>
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: "var(--foreground)" }}>
                Outcome
              </th>
              <th
                className="px-4 py-3 text-right font-semibold cursor-pointer hover:opacity-70"
                onClick={() => toggleSort("volume")}
                style={{ color: "var(--foreground)" }}
              >
                <div className="flex items-center justify-end gap-2">
                  Volume
                  {sortField === "volume" && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      className={sortOrder === "asc" ? "rotate-180" : ""}
                    >
                      <polygon points="6,2 12,10 0,10" />
                    </svg>
                  )}
                </div>
              </th>
              {filterable && (
                <th
                  className="px-4 py-3 text-right font-semibold cursor-pointer hover:opacity-70"
                  onClick={() => toggleSort("accuracy")}
                  style={{ color: "var(--foreground)" }}
                >
                  <div className="flex items-center justify-end gap-2">
                    Accuracy
                    {sortField === "accuracy" && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        className={sortOrder === "asc" ? "rotate-180" : ""}
                      >
                        <polygon points="6,2 12,10 0,10" />
                      </svg>
                    )}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.length === 0 ? (
              <tr>
                <td
                  colSpan={filterable ? 5 : 4}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)" }}
                >
                  No resolved markets found
                </td>
              </tr>
            ) : (
              filteredMarkets.map((market) => {
                const outcomeColor = getOutcomeColor(market.outcome);
                return (
                  <tr
                    key={market.id}
                    onClick={() => onMarketClick?.(market)}
                    className="border-t cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium line-clamp-1" style={{ color: "var(--foreground)" }}>
                          {market.title}
                        </p>
                        <p className="text-xs line-clamp-1" style={{ color: "var(--muted)" }}>
                          {market.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                      {market.resolvedAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: outcomeColor.bg,
                          color: outcomeColor.text,
                          border: `1px solid ${outcomeColor.border}`,
                        }}
                      >
                        {market.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--foreground)" }}>
                      ${market.volume.toLocaleString()}
                    </td>
                    {filterable && (
                      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--foreground)" }}>
                        {market.accuracy !== undefined ? `${market.accuracy}%` : "—"}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Resolution Details (if available) */}
      {filteredMarkets.length > 0 && filteredMarkets[0].resolutionProof && (
        <div
          className="p-4 rounded-lg"
          style={{ background: "var(--border)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>
            Resolution Source
          </p>
          <p className="text-sm" style={{ color: "var(--foreground)" }}>
            {filteredMarkets[0].resolutionSource || "Official Resolution"}
          </p>
        </div>
      )}
    </div>
  );
}
