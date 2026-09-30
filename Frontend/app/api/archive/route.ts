import { NextResponse, NextRequest } from "next/server";

export interface ArchivedMarket {
  id: string;
  title: string;
  description: string;
  category: string;
  resolvedOutcome: "yes" | "no" | "cancelled";
  resolutionDate: string;
  volume: number;
  participants: number;
  createdAt: string;
  endDate: string;
  finalPrice: number;
}

const MOCK_ARCHIVED_MARKETS: ArchivedMarket[] = [
  {
    id: "1",
    title: "Will AA123 arrive on time?",
    description: "American Airlines flight AA123 from JFK to LAX on Apr 20, 2026.",
    category: "flight",
    resolvedOutcome: "yes",
    resolutionDate: "2026-04-20T18:30:00Z",
    volume: 14820,
    participants: 87,
    createdAt: "2026-04-15T10:00:00Z",
    endDate: "2026-04-20T18:00:00Z",
    finalPrice: 0.78,
  },
  {
    id: "2",
    title: "Will UA456 be delayed > 30 min?",
    description: "United Airlines flight UA456 from ORD to SFO on Apr 19, 2026.",
    category: "flight",
    resolvedOutcome: "no",
    resolutionDate: "2026-04-19T22:15:00Z",
    volume: 8300,
    participants: 45,
    createdAt: "2026-04-14T14:30:00Z",
    endDate: "2026-04-19T21:00:00Z",
    finalPrice: 0.22,
  },
  {
    id: "3",
    title: "Will DL789 be cancelled?",
    description: "Delta Airlines flight DL789 from ATL to MIA on Apr 18, 2026.",
    category: "flight",
    resolvedOutcome: "cancelled",
    resolutionDate: "2026-04-18T14:00:00Z",
    volume: 3200,
    participants: 23,
    createdAt: "2026-04-13T09:15:00Z",
    endDate: "2026-04-18T12:00:00Z",
    finalPrice: 0.0,
  },
  {
    id: "4",
    title: "Will Bitcoin exceed $90k by Apr 2026?",
    description: "Bitcoin price prediction for April 2026.",
    category: "crypto",
    resolvedOutcome: "yes",
    resolutionDate: "2026-04-30T00:00:00Z",
    volume: 125000,
    participants: 1200,
    createdAt: "2026-04-01T08:00:00Z",
    endDate: "2026-04-30T00:00:00Z",
    finalPrice: 0.85,
  },
  {
    id: "5",
    title: "Will Ethereum outperform Bitcoin in Apr 2026?",
    description: "Ethereum vs Bitcoin performance comparison for April 2026.",
    category: "crypto",
    resolvedOutcome: "no",
    resolutionDate: "2026-05-01T00:00:00Z",
    volume: 89000,
    participants: 890,
    createdAt: "2026-04-05T12:00:00Z",
    endDate: "2026-05-01T00:00:00Z",
    finalPrice: 0.35,
  },
  {
    id: "6",
    title: "Will the Lakers win in April 2026?",
    description: "Lakers game outcome prediction.",
    category: "sports",
    resolvedOutcome: "yes",
    resolutionDate: "2026-04-25T23:00:00Z",
    volume: 45000,
    participants: 567,
    createdAt: "2026-04-20T16:00:00Z",
    endDate: "2026-04-25T22:00:00Z",
    finalPrice: 0.72,
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("fail") === "true") {
    return NextResponse.json(
      { error: "Failed to fetch archive data from server" },
      { status: 500 }
    );
  }

  return NextResponse.json({ markets: MOCK_ARCHIVED_MARKETS }, { status: 200 });
}
