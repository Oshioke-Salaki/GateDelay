import { NextResponse } from "next/server";

const TRENDING_MARKETS = [
    {
        id: "5",
        title: "Will BA202 arrive early?",
        description: "British Airways BA202 from LHR to JFK on Apr 29, 2026.",
        status: "resolved",
        yesPrice: 0.55,
        noPrice: 0.45,
        volume: 21000,
        liquidity: 9000,
        activityScore: 28,
    },
    {
        id: "1",
        title: "Will AA123 arrive on time?",
        description: "American Airlines AA123 from JFK to LAX on Apr 25, 2026.",
        status: "open",
        yesPrice: 0.62,
        noPrice: 0.38,
        volume: 14820,
        liquidity: 5400,
        activityScore: 22,
    },
    {
        id: "4",
        title: "Will SW101 depart on time?",
        description: "Southwest SW101 from DAL to DEN on Apr 28, 2026.",
        status: "open",
        yesPrice: 0.75,
        noPrice: 0.25,
        volume: 6700,
        liquidity: 2800,
        activityScore: 16,
    },
];

export async function GET() {
    return NextResponse.json({ markets: TRENDING_MARKETS }, { status: 200 });
}
