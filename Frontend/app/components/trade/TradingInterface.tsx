"use client";

import { useState } from "react";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import MarketInfo from "./MarketInfo";
import TradingChart from "./TradingChart";
import OrderPanel from "./OrderPanel";
import OrderBookCompact from "./OrderBookCompact";
import RecentTrades from "./RecentTrades";
import UserPositions from "./UserPositions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Market {
    id: string;
    name: string;
    description: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    totalLiquidity: number;
    expiryDate: string;
    status: "active" | "closed" | "resolved";
}

interface TradingInterfaceProps {
    market: Market;
    userAddress?: string;
}

// ─── Trading Interface ────────────────────────────────────────────────────────

export default function TradingInterface({ market, userAddress }: TradingInterfaceProps) {
    const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
    const [viewMode, setViewMode] = useState<"standard" | "advanced">("standard");

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-6">
                {/* Market Info Header */}
                <ComponentErrorBoundary componentName="MarketInfo">
                    <MarketInfo market={market} />
                </ComponentErrorBoundary>

                {/* Main Trading Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                    {/* Left Column - Chart & Order Book */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Trading Chart */}
                        <ComponentErrorBoundary componentName="TradingChart">
                            <TradingChart marketId={market.id} />
                        </ComponentErrorBoundary>

                        {/* Order Book & Recent Trades - Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
                            <ComponentErrorBoundary componentName="OrderBookCompact">
                                <OrderBookCompact marketId={market.id} userAddress={userAddress} />
                            </ComponentErrorBoundary>

                            <ComponentErrorBoundary componentName="RecentTrades">
                                <RecentTrades marketId={market.id} />
                            </ComponentErrorBoundary>
                        </div>
                    </div>

                    {/* Right Column - Order Panel */}
                    <div className="lg:col-span-4">
                        <ComponentErrorBoundary componentName="OrderPanel">
                            <OrderPanel
                                market={market}
                                userAddress={userAddress}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </ComponentErrorBoundary>
                    </div>
                </div>

                {/* Order Book & Recent Trades - Mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 lg:hidden">
                    <ComponentErrorBoundary componentName="OrderBookCompact">
                        <OrderBookCompact marketId={market.id} userAddress={userAddress} />
                    </ComponentErrorBoundary>

                    <ComponentErrorBoundary componentName="RecentTrades">
                        <RecentTrades marketId={market.id} />
                    </ComponentErrorBoundary>
                </div>

                {/* User Positions */}
                {userAddress && (
                    <div className="mt-6">
                        <ComponentErrorBoundary componentName="UserPositions">
                            <UserPositions marketId={market.id} userAddress={userAddress} />
                        </ComponentErrorBoundary>
                    </div>
                )}
            </div>
        </div>
    );
}
