"use client";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Search, Calendar, Filter } from "lucide-react";
import type { ArchivedMarket } from "../../app/archive/page";

interface ArchiveViewProps {
  markets: ArchivedMarket[];
}

export default function ArchiveView({ markets }: ArchiveViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filtered = useMemo(() => {
    return markets.filter((market) => {
      const matchesSearch =
        market.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        market.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOutcome =
        !selectedOutcome || market.resolvedOutcome === selectedOutcome;

      const matchesCategory =
        !selectedCategory || market.category === selectedCategory;

      const resDate = new Date(market.resolutionDate).getTime();
      const matchesDateFrom = !dateFrom || resDate >= new Date(dateFrom).getTime();
      const matchesDateTo = !dateTo || resDate <= new Date(dateTo).getTime();

      return (
        matchesSearch &&
        matchesOutcome &&
        matchesCategory &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [markets, searchTerm, selectedOutcome, selectedCategory, dateFrom, dateTo]);

  const categories = useMemo(
    () => [...new Set(markets.map((m) => m.category))],
    [markets]
  );

  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((sum, m) => sum + m.volume, 0);
    const totalParticipants = filtered.reduce((sum, m) => sum + m.participants, 0);
    const avgPrice = filtered.length > 0
      ? (filtered.reduce((sum, m) => sum + m.finalPrice, 0) / filtered.length).toFixed(2)
      : "0.00";

    return { totalVolume, totalParticipants, avgPrice };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Total Volume
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
            {stats.totalVolume.toLocaleString()}
          </p>
        </div>
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Total Participants
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
            {stats.totalParticipants.toLocaleString()}
          </p>
        </div>
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Avg Final Price
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
            ${stats.avgPrice}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-lg p-4 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} style={{ color: "var(--muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Filters
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Outcome filter */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            Resolution Outcome
          </label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {["yes", "no", "cancelled"].map((outcome) => (
              <button
                key={outcome}
                onClick={() =>
                  setSelectedOutcome(
                    selectedOutcome === outcome ? null : outcome
                  )
                }
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background:
                    selectedOutcome === outcome
                      ? outcome === "yes"
                        ? "#22c55e"
                        : outcome === "no"
                        ? "#ef4444"
                        : "#8b5cf6"
                      : "var(--background)",
                  color:
                    selectedOutcome === outcome
                      ? "white"
                      : "var(--foreground)",
                  border:
                    selectedOutcome === outcome
                      ? "none"
                      : "1px solid var(--border)",
                }}
              >
                {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            Category
          </label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat ? null : cat)
                }
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background:
                    selectedCategory === cat
                      ? "var(--foreground)"
                      : "var(--background)",
                  color:
                    selectedCategory === cat
                      ? "var(--background)"
                      : "var(--foreground)",
                  border:
                    selectedCategory === cat
                      ? "none"
                      : "1px solid var(--border)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Date range filter */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              From Date
            </label>
            <div className="relative mt-2">
              <Calendar
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              To Date
            </label>
            <div className="relative mt-2">
              <Calendar
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {filtered.length} Market{filtered.length !== 1 ? "s" : ""} Found
        </p>

        {filtered.length === 0 ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p style={{ color: "var(--muted)" }}>No markets match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((market) => (
              <div
                key={market.id}
                className="rounded-lg p-4"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {market.title}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {market.description}
                    </p>
                    <div className="flex gap-4 mt-3 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Volume: {market.volume.toLocaleString()}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Participants: {market.participants}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Resolved: {format(new Date(market.resolutionDate), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="px-3 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background:
                          market.resolvedOutcome === "yes"
                            ? "#22c55e"
                            : market.resolvedOutcome === "no"
                            ? "#ef4444"
                            : "#8b5cf6",
                        color: "white",
                      }}
                    >
                      {market.resolvedOutcome === "yes"
                        ? "YES"
                        : market.resolvedOutcome === "no"
                        ? "NO"
                        : "CANCELLED"}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      ${market.finalPrice.toFixed(2)}
                    </span>
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
