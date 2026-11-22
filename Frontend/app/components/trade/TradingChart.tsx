"use client";

import PriceChart from "@/components/chart/PriceChart";

export default function TradingChart({ marketId }: { marketId: string }) {
  return <PriceChart marketId={marketId} />;
}
