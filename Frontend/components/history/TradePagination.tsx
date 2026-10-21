"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Filter,
} from "lucide-react";
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

function validateTradeHistoryResponse(data: unknown): TradeHistoryResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid trade history response");
  }
  const response = data as Record<string, unknown>;
  if (
    !Array.isArray(response.trades) ||
    !response.trades.every((trade: unknown) => {
      if (!trade || typeof trade !== "object") return false;
      const row = trade as Record<string, unknown>;
      return ["id", "pair", "price", "amount", "timestamp"].every(
        (key) => typeof row[key] === "string"
      ) && (row.side === "BUY" || row.side === "SELL") &&
        (row.orderId === undefined || typeof row.orderId === "string") &&
        (row.userId === undefined || typeof row.userId === "string");
    }) ||
    !["total", "page", "totalPages"].every(
      (key) => typeof response[key] === "number" && Number.isSafeInteger(response[key]) &&
        (response[key] as number) >= (key === "page" ? 1 : 0)
    )
  ) {
    throw new Error("Invalid trade history response");
  }
  return response as unknown as TradeHistoryResponse;
}

/**
 * FE-004: Accept an AbortSignal and pass it to fetch so React Query can cancel
 * in-flight requests when filters change or the component unmounts.
 */
const fetchTradeHistory = async (
  pair: string,
  page: number,
  limit: number,
  side?: string,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<TradeHistoryResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (side && side !== "all") {
    params.set("side", side);
  }
  if (startDate) {
    // `type=date` values stay date-only; the backend interprets them as UTC days.
    params.set("startDate", startDate);
  }
  if (endDate) {
    // The backend treats this selected day as inclusive and uses next UTC midnight exclusively.
    params.set("endDate", endDate);
  }

  const response = await fetch(
    `/api/trades/history/${encodeURIComponent(pair)}?${params.toString()}`,
    { signal } // FE-004: propagate cancellation signal
  );

  if (!response.ok) {
    throw new Error("Failed to fetch trade history");
  }
  const data = await response.json();
  
  // Validate response before returning
  return validateTradeHistoryResponse(data);
};

export default function TradePagination({
  pair = "BTC/USDT",
  pageSize = 20,
  showFilters = true,
}: TradePaginationProps) {
  const startDateId = useId();
  const [page, setPage] = useState(1);

  /**
   * FE-001: Maintain an internal page-size state so the select element is
   * controlled by local state (not the `pageSize` prop), and the outgoing
   * query uses the same value.
   */
  const [currentPageSize, setCurrentPageSize] = useState<number>(pageSize);

  const [sideFilter, setSideFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  /**
   * FE-002: Reset page to 1 whenever the trading pair prop changes.
   * This prevents stale page state from a previous pair (e.g. page 5 on
   * BTC/USDT) being sent in the first request for the new pair.
   */
  useEffect(() => {
    setPage(1);
  }, [pair]);

  const { data, isLoading, isError, isFetching } = useQuery<TradeHistoryResponse>({
    queryKey: [
      "trades",
      pair,
      page,
      currentPageSize, // FE-001: use local state, not the prop
      sideFilter,
      startDate,
      endDate,
    ],
    /**
     * FE-004: Destructure `signal` from the React Query context and forward it
     * to the fetch wrapper so stale requests are aborted automatically.
     */
    queryFn: ({ signal }) =>
      fetchTradeHistory(
        pair,
        page,
        currentPageSize, // FE-001: consistent with query key
        sideFilter,
        startDate,
        endDate,
        signal // FE-004
      ),
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  const trades = data?.trades || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  /**
   * FE-003: Clamp the current page to the last valid page whenever
   * `totalPages` shrinks (e.g. after trades are deleted while viewing the
   * final page).
   */
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

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

  /**
   * FE-001: Store the new size in local state so:
   *  1. The select element reflects the chosen value immediately (controlled).
   *  2. The query key and the outgoing `limit` parameter both use the new size.
   *  3. Page resets to 1 so the first page of the new page-size is fetched.
   */
  const handlePageSizeChange = useCallback((newSize: number) => {
    setCurrentPageSize(newSize);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSideFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }, []);

  useEffect(() => {
    // Date input values are canonical YYYY-MM-DD strings, so lexical comparison
    // is timezone-independent and preserves their calendar-day meaning.
    if (startDate && endDate && startDate > endDate) {
      const temp = startDate;
      setStartDate(endDate);
      setEndDate(temp);
    }
  }, [startDate, endDate]);

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-2xl shadow-sm font-sans w-full"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
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
            <label htmlFor={startDateId} className="text-xs" style={{ color: "var(--muted)" }}>
              Start Date
            </label>
            <input
              id={startDateId}
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
          <p className="w-full text-xs" style={{ color: "var(--muted)" }}>
            Dates use UTC. The start date is inclusive; the end date includes the
            full selected day and stops before midnight UTC the following day.
          </p>
        </div>
      )}

      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: "1px solid var(--border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                Time
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                Pair
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                Price
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                Amount
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-semibold"
                style={{ color: "var(--muted)" }}
              >
                Side
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  Loading trades...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "#ef4444" }}
                >
                  Failed to load trades
                </td>
              </tr>
            ) : trades.length === 0 ? (
              // FE-003: Consistent empty state when there are zero results
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  No trades found
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td
                    className="px-4 py-3 whitespace-nowrap text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatDateTime(trade.timestamp)}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: "var(--foreground)" }}
                  >
                    {trade.pair}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap text-right"
                    style={{ color: "var(--foreground)" }}
                  >
                    $
                    {parseFloat(trade.price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap text-right"
                    style={{ color: "var(--foreground)" }}
                  >
                    {parseFloat(trade.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background:
                          trade.side === "BUY" ? "#22c55e22" : "#ef444422",
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
          {total} trade{total !== 1 ? "s" : ""} · Page {page} of{" "}
          {totalPages || 1}
        </span>
        <div className="flex items-center gap-2">
          {/* FE-001: select is controlled by currentPageSize (local state) */}
          <select
            value={currentPageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
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
