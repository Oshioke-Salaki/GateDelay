import { NextResponse } from "next/server";
import { resolveApiBase, MissingApiBaseError } from "../../../lib/apiBase";

/**
 * GET /api/market-sentiment?marketId=…
 *
 * Proxies the browser to the backend AI sentiment cache so the client bundle
 * never needs the backend origin. Live refreshes are driven by the app-shell
 * WebSocket (`WebSocketProvider` + `useWebSocket`): `MarketSentiment` invalidates
 * its React Query key on `priceUpdate` / `marketData` for the same marketId.
 *
 * Upstream: GET `${NEXT_PUBLIC_API_URL}/ai/sentiment/:marketId`
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId")?.trim();

  if (!marketId) {
    return NextResponse.json(
      { error: "marketId is required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  let apiBase: string;
  try {
    apiBase = resolveApiBase();
  } catch (error) {
    if (error instanceof MissingApiBaseError) {
      return NextResponse.json(
        { error: error.message, code: "CONFIG_ERROR" },
        { status: 500 },
      );
    }
    throw error;
  }

  const backendUrl = `${apiBase}/ai/sentiment/${encodeURIComponent(marketId)}`;
  const authHeader = req.headers.get("authorization");

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      // Sentiment is cached server-side; short revalidate keeps UI fresh without
      // hammering the AI pipeline on every market tick.
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        {
          error: text || "Failed to load sentiment",
          code: "UPSTREAM_ERROR",
          marketId,
        },
        { status: res.status },
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return NextResponse.json(
        {
          error: "Backend returned a malformed sentiment payload",
          code: "UPSTREAM_ERROR",
          marketId,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to the backend",
        code: "BACKEND_UNREACHABLE",
        marketId,
      },
      { status: 502 },
    );
  }
}
