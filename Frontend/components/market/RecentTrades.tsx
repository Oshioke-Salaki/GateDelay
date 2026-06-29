"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export interface Trade {
  id: string;
  price: number;
  amount: number;
  side: "YES" | "NO";
  timestamp: Date;
  isUserTrade?: boolean;
}

const LARGE_TRADE_THRESHOLD = 500; // Example threshold: $500
const MAX_TRADES = 50; // Performance constraint: keep max 50 trades in DOM

interface RecentTradesProps {
  marketId: string;
}

export default function RecentTrades({ marketId }: RecentTradesProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate some initial mock trades
    const initialTrades: Trade[] = Array.from({ length: 15 }).map((_, i) => {
      const d = new Date();
      d.setSeconds(d.getSeconds() - (15 - i) * 5); // space them out
      return generateMockTrade(d);
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    setTrades(initialTrades);

    // Simulate real-time data stream
    const interval = setInterval(() => {
      const newTrade = generateMockTrade(new Date());
      setTrades((prev) => {
        const updated = [newTrade, ...prev];
        return updated.slice(0, MAX_TRADES); // Cap to avoid infinite growth
      });
    }, Math.random() * 2000 + 1000); // New trade every 1-3 seconds

    return () => clearInterval(interval);
  }, [marketId]);

  return (
    <div className="flex flex-col h-[400px] rounded-xl overflow-hidden shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3 font-semibold text-sm" style={{ borderBottom: "1px solid var(--border)", color: "var(--foreground)" }}>
        Recent Trades
      </div>
      
      {/* Header */}
      <div className="flex items-center px-4 py-2 text-xs font-medium sticky top-0 z-10" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
        <div className="w-20">Time</div>
        <div className="flex-1">Price</div>
        <div className="w-28 text-right">Amount</div>
      </div>

      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <AnimatePresence initial={false}>
          {trades.map((trade) => {
            const isLarge = trade.amount >= LARGE_TRADE_THRESHOLD;
            const sideColor = trade.side === "YES" ? "#22c55e" : "#ef4444";
            // Highlight user trades slightly
            const rowBg = trade.isUserTrade ? "rgba(59, 130, 246, 0.08)" : "transparent";

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, height: 0, y: -10, backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                animate={{ opacity: 1, height: "auto", y: 0, backgroundColor: rowBg }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center px-4 py-3 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${isLarge ? "font-semibold" : ""}`}
                style={{ borderBottom: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <div className="w-20 whitespace-nowrap text-xs" style={{ color: "var(--muted)" }}>
                  {format(trade.timestamp, "HH:mm:ss")}
                </div>
                <div className="flex-1 whitespace-nowrap" style={{ color: sideColor }}>
                  {(trade.price * 100).toFixed(0)}¢ <span className="text-xs ml-1 font-normal" style={{ color: "var(--muted)" }}>{trade.side}</span>
                </div>
                <div className="w-28 whitespace-nowrap text-right">
                  <span className={isLarge ? "text-amber-500 flex items-center justify-end gap-1" : ""}>
                    {isLarge && <span title="Large Trade" aria-label="Large Trade">🔥</span>}
                    ${trade.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function generateMockTrade(date: Date): Trade {
  const isYes = Math.random() > 0.5;
  const isLarge = Math.random() > 0.9;
  const isUser = Math.random() > 0.95;
  return {
    id: Math.random().toString(36).substring(2, 9),
    price: Math.random() * 0.98 + 0.01,
    amount: isLarge ? Math.floor(Math.random() * 5000) + 500 : Math.floor(Math.random() * 450) + 10,
    side: isYes ? "YES" : "NO",
    timestamp: date,
    isUserTrade: isUser,
  };
}
