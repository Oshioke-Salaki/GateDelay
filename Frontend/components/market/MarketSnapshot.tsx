"use client";

import { useState, useEffect, useMemo } from "react";
import { format, parseISO, isValid } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Clock, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface MarketSnapshot {
  id: string;
  pair: string;
  price: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  orderBook: {
    bids: Array<{ price: string; amount: string }>;
    asks: Array<{ price: string; amount: string }>;
  };
  timestamp: string;
  createdAt?: string;
}

interface MarketSnapshotProps {
  pair?: string;
  initialSnapshot?: MarketSnapshot;
}

const fetchSnapshots = async (pair: string): Promise<MarketSnapshot[]> => {
  const response = await fetch(`/api/snapshots/${encodeURIComponent(pair)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch snapshots");
  }
  const data = await response.json();
  return data.data || [];
};

const fetchSnapshotById = async (id: string): Promise<MarketSnapshot> => {
  const response = await fetch(`/api/snapshots/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch snapshot");
  }
  const data = await response.json();
  return data.data;
};

function SnapshotDatePicker({
  selectedDate,
  onDateChange,
  snapshots,
}: {
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
  snapshots: MarketSnapshot[];
}) {
  const availableDates = useMemo(() => {
    return snapshots.map((s) => {
      const d = parseISO(s.timestamp);
      return isValid(d) ? d : null;
    }).filter(Boolean) as Date[];
  }, [snapshots]);

  return (
    <div className="flex items-center gap-2">
      <Calendar size={16} style={{ color: "var(--muted)" }} />
      <input
        type="date"
        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
        onChange={(e) => {
          const date = e.target.value ? parseISO(e.target.value) : null;
          if (date && isValid(date)) {
            onDateChange(date);
          }
        }}
        className="rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
        max={format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}

function SnapshotNavigator({
  currentIndex,
  total,
  onPrevious,
  onNext,
  onRefresh,
  loading,
}: {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevious}
          disabled={currentIndex <= 0}
          className="rounded-lg p-2 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          aria-label="Previous snapshot"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {total > 0 ? `${currentIndex + 1} of ${total}` : "No snapshots"}
        </span>
        <button
          onClick={onNext}
          disabled={currentIndex >= total - 1}
          className="rounded-lg p-2 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          aria-label="Next snapshot"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded-lg p-2 transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
        aria-label="Refresh snapshots"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

function OrderBookDisplay({
  orderBook,
}: {
  orderBook?: MarketSnapshot["orderBook"];
}) {
  if (!orderBook) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
          Bids
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {orderBook.bids.map((bid, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span style={{ color: "#22c55e" }}>{bid.price}</span>
              <span style={{ color: "var(--foreground)" }}>{bid.amount}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
          Asks
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {orderBook.asks.map((ask, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span style={{ color: "#ef4444" }}>{ask.price}</span>
              <span style={{ color: "var(--foreground)" }}>{ask.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MarketSnapshotDisplay({ pair = "BTC/USDT", initialSnapshot }: MarketSnapshotProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const { data: snapshots = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["snapshots", pair],
    queryFn: () => fetchSnapshots(pair),
    staleTime: 60000,
  });

  const currentSnapshot = snapshots[currentIndex] || initialSnapshot;

  useEffect(() => {
    if (selectedDate && snapshots.length > 0) {
      const index = snapshots.findIndex((s) => {
        const d = parseISO(s.timestamp);
        return isValid(d) && format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
      });
      if (index >= 0) {
        setCurrentIndex(index);
      }
    }
  }, [selectedDate, snapshots]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(snapshots.length - 1, prev + 1));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["snapshots", pair] });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading snapshots...
        </div>
      </div>
    );
  }

  if (isError || !currentSnapshot) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm" style={{ color: "#ef4444" }}>
          Failed to load snapshots
        </div>
      </div>
    );
  }

  const snapshotDate = parseISO(currentSnapshot.timestamp);

  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl shadow-sm font-sans w-full" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          Market Snapshot
        </h2>
        <SnapshotDatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          snapshots={snapshots}
        />
      </div>

      <SnapshotNavigator
        currentIndex={currentIndex}
        total={snapshots.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onRefresh={handleRefresh}
        loading={isLoading}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>Price</p>
          <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            ${parseFloat(currentSnapshot.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>24h Volume</p>
          <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            ${parseFloat(currentSnapshot.volume24h).toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>24h High</p>
          <p className="text-lg font-bold" style={{ color: "#22c55e" }}>
            ${parseFloat(currentSnapshot.high24h).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>24h Low</p>
          <p className="text-lg font-bold" style={{ color: "#ef4444" }}>
            ${parseFloat(currentSnapshot.low24h).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <OrderBookDisplay orderBook={currentSnapshot.orderBook} />

      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <Clock size={14} />
        <span>
          {isValid(snapshotDate) ? format(snapshotDate, "PPpp") : "Invalid date"}
        </span>
      </div>
    </div>
  );
}