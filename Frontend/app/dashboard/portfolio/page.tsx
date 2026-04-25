"use client";

import DashboardLayout from "../../../components/layout/DashboardLayout";
import PortfolioWidget from "../../../components/portfolio/PortfolioWidget";

export default function PortfolioPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-2">
        <div className="mb-2">
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            Portfolio
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Track your positions, balance, and performance across all markets.
          </p>
        </div>
        <PortfolioWidget />
      </div>
    </DashboardLayout>
  );
}
