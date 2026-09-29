"use client";

import VolatilityChart from "../../components/chart/VolatilityChart";

export default function VolatilityClient() {
  return (
    <div className="space-y-6">
      <VolatilityChart
        title="YES/NO Market Volatility"
        accentColor="#f59e0b"
        isLive
      />
    </div>
  );
}
