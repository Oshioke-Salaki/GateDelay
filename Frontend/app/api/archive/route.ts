import { NextResponse, NextRequest } from "next/server";
import { resolveApiBase } from "@/lib/apiBase";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const upstreamUrl = `${resolveApiBase()}/archive${query ? `?${query}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch archive data from server" },
      { status: 502 }
    );
  }

  const body = await upstream.text();

  if (!upstream.ok) {
    let errorBody: unknown;
    try {
      errorBody = JSON.parse(body);
    } catch {
      errorBody = { error: body || "Failed to fetch archive data from server" };
    }
    return NextResponse.json(errorBody, { status: upstream.status });
  }

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
