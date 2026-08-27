import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId");
  const operation = url.searchParams.get("operation");
  const actor = url.searchParams.get("actor");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = url.searchParams.get("limit");

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
  
  // Build query string
  const queryParams = new URLSearchParams();
  if (marketId) queryParams.set("marketId", marketId);
  if (operation) queryParams.set("operation", operation);
  if (actor) queryParams.set("actor", actor);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (limit) queryParams.set("limit", limit);

  const backendUrl = `${apiBase.replace(/\/$/, "")}/market-audit/logs?${queryParams.toString()}`;

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json({ error: text || "Failed to load audit logs" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to connect to backend" }, { status: 500 });
  }
}
