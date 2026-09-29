import { NextResponse } from "next/server";

/**
 * GET /api/ping
 *
 * Ultra-lightweight probe endpoint used by `useLatency` to measure
 * round-trip time via the browser's Performance API.
 *
 * Returns a minimal JSON body with a server timestamp so callers can
 * optionally calculate clock skew, but the response body is intentionally
 * tiny to minimise transfer overhead.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    {
      status: 200,
      headers: {
        // Ensure the response is never served from cache
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

/**
 * HEAD /api/ping
 *
 * Identical semantics to GET but without a response body.
 * `useLatency` prefers HEAD to keep transfer bytes near zero.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
