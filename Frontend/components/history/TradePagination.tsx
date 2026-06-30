"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast, Filter } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

export interface Trade {
  id: string;
  pair: string;
  price: string;
  amount: string;
  side: "BUY" | "SELL";
  timestamp: string;
  orderId?: string;
  userId?: string;
}

interface TradePaginationProps {
  pair?: string;
  pageSize?: number;
  showFilters?: boolean;
}

interface TradeHistoryResponse {
  trades: Trade[];
  total: number;
  page: number;
  totalPages: number;
}

const fetchTradeHistory = async (
  pair: string,
  page: number,
  limit: number,
  side?: string,
  startDate?: string,
  endDate?: string
): Promise<TradeHistoryResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (side && side !== "all") {
    params.set("side", side);
  }
  if (startDate) {
    params.set("startDate", startDate);
  }
  if (endDate) {
    params.set("endDate", endDate);
  }

  const response = await fetch(`/api/trades/history/${encodeURIComponent(pair)}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch trade history");
  }
  const data = await response.json();
  return data.data;
};

export default function TradePagination({
  pair = "BTC/USDT",
  pageSize = 20,
  showFilters = true,
}: TradePaginationProps) {
  const [page, setPage] = useState(1);
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["trades", pair, page, pageSize, sideFilter, startDate, endDate],
    queryFn: () => fetchTradeHistory(pair, page, pageSize, sideFilter, startDate, endDate),
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });

  const trades = data?.trades || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const formatDateTime = useCallback((timestamp: string) => {
    const date = parseISO(timestamp);
    return isValid(date) ? format(date, "MMM d, HH:mm:ss") : "Invalid date";
  }, []);

  const sideColor = useCallback((side: "BUY" | "SELL") => {
    return side === "BUY" ? "#22c55e" : "#ef4444";
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handleFirstPage = useCallback(() => {
    setPage(1);
  }, []);

  const handleLastPage = useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["trades", pair] });
    },
    [pair, queryClient]
  );

  const clearFilters = useCallback(() => {
    setSideFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }, []);

  useEffect(() => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      const temp = startDate;
      setStartDate(endDate);
      setEndDate(temp);
    }
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl shadow-sm font-sans w-full" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          Trade History
        </h2>
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: "var(--muted)" }} />
            <select
              value={sideFilter}
              onChange={(e) => {
                setSideFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="all">All Sides</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              min={startDate}
              className="rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          {(sideFilter !== "all" || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Pair
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Amount
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Side
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                  Loading trades...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "#ef4444" }}>
                  Failed to load trades
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No trades found
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "var(--muted)" }}>
                    {formatDateTime(trade.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                    {trade.pair}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right" style={{ color: "var(--foreground)" }}>
                    ${parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right" style={{ color: "var(--foreground)" }}>
                    {parseFloat(trade.amount).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: trade.side === "BUY" ? "#22c55e22" : "#ef444422",
                        color: sideColor(trade.side),
                      }}
                    >
                      {trade.side}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <span style={{ color: "var(--muted)" }}>
          {total} trade{total !== 1 ? "s" : ""} · Page {page} of {totalPages || 1}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={handleFirstPage}
              disabled={page === 1 || isFetching}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="First page"
            >
              <ChevronFirst size={16} />
            </button>
            <button
              onClick={handlePreviousPage}
              disabled={page === 1 || isFetching}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages || isFetching}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={handleLastPage}
              disabled={page === totalPages || isFetching}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label="Last page"
            >
              <ChevronLast size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}