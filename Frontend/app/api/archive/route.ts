import { NextResponse } from "next/server";
import { resolveApiBase, MissingApiBaseError } from "../../../lib/apiBase";

/**
 * GET /api/archive
 *
 * Proxies the browser to the backend's resolved-markets endpoint so the client
 * bundle never needs the backend origin, and so a misconfigured deployment
 * surfaces as a JSON error rather than a blank page.
 *
 * Supported filters are forwarded verbatim: `category`, `outcome`, `from`, `to`,
 * `limit`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const forwarded = new URLSearchParams();
  for (const key of ["category", "outcome", "from", "to", "limit"]) {
    const value = url.searchParams.get(key);
    if (value) forwarded.set(key, value);
  }

  let apiBase: string;
  try {
    apiBase = resolveApiBase();
  } catch (error) {
    if (error instanceof MissingApiBaseError) {
      // Configuration fault, not an upstream one — say so plainly.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  const backendUrl = `${apiBase}/markets/archive?${forwarded.toString()}`;

  try {
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Archived markets are immutable once resolved, but the list itself grows.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return NextResponse.json(
        { error: text || "Failed to load archived markets" },
        { status: res.status },
      );
    }

    return NextResponse.json(await res.json(), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to the backend",
      },
      { status: 502 },
    );
  }
}
