import { NextResponse } from "next/server";

// Minimal proxy for now.
// It fetches cached AI sentiment from the backend:
// GET /ai/sentiment/:marketId
//
// NOTE: Backend AI sentiment endpoint currently returns only { marketId, signal, generatedAt }.
// This route mirrors that shape.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId");

  if (!marketId) {
    return NextResponse.json({ error: "marketId is required" }, { status: 400 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
  const backendUrl = `${apiBase.replace(/\/$/, "")}/ai/sentiment/${encodeURIComponent(marketId)}`;

  const res = await fetch(backendUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text || "Failed to load sentiment" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 200 });
}


