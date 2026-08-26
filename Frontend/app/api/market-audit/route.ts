import { NextResponse } from "next/server";
import { resolveApiBase, MissingApiBaseError } from "../../../lib/apiBase";

/**
 * GET /api/market-audit
 *
 * Proxies the browser to the NestJS market-audit logs endpoint so the client
 * never learns the backend origin, and so a misconfigured production deploy
 * returns a JSON error instead of silently calling localhost.
 *
 * Supported filters (forwarded verbatim): `marketId`, `operation`, `actor`,
 * `from`, `to`, `limit`.
 *
 * Upstream: GET `${NEXT_PUBLIC_API_URL}/market-audit/logs`
 */

const FORWARDED_KEYS = ["marketId", "operation", "actor", "from", "to", "limit"] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);

  const queryParams = new URLSearchParams();
  for (const key of FORWARDED_KEYS) {
    const value = url.searchParams.get(key);
    if (value) queryParams.set(key, value);
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

  const backendUrl = `${apiBase}/market-audit/logs?${queryParams.toString()}`;

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: text || "Failed to load audit logs", code: "UPSTREAM_ERROR" },
        { status: res.status },
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return NextResponse.json(
        {
          error: "Backend returned a malformed audit-log payload",
          code: "UPSTREAM_ERROR",
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
      },
      { status: 502 },
    );
  }
}
