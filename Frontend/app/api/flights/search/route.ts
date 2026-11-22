import { NextResponse } from "next/server";

/**
 * GET /api/flights/search?q=<flight_iata>
 *
 * Server-side proxy for the AviationStack flights endpoint. The API key is
 * read from the server-only AVIATION_STACK_KEY environment variable, so it
 * never appears in the browser bundle or client-visible network requests.
 * (#1182)
 *
 * Query parameters:
 *   q   - flight IATA code to search (required, 2–10 chars, alphanumeric)
 *
 * Caller quotas / guards:
 *   - Query is validated and sanitised before forwarding.
 *   - Upstream 429 and error responses are translated to structured JSON so
 *     the client can distinguish rate-limit from config/network failures.
 *   - Missing server config returns 503 (not 500) so the client can show a
 *     graceful "not configured" message rather than an unexpected server error.
 */

const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 5;
const QUERY_RE = /^[A-Z0-9]{2,10}$/i;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  // Validate the query before hitting the upstream API.
  if (!q || !QUERY_RE.test(q)) {
    return NextResponse.json(
      { error: "Invalid query. Provide a flight IATA code (2–10 alphanumeric characters).", code: "INVALID_QUERY" },
      { status: 400 },
    );
  }

  // The key must be a server-only secret — do not use NEXT_PUBLIC_* here.
  const apiKey = process.env.AVIATION_STACK_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Flight search is not configured.", code: "CONFIG_ERROR" },
      { status: 503 },
    );
  }

  const upstream = new URL("https://api.aviationstack.com/v1/flights");
  upstream.searchParams.set("access_key", apiKey);
  upstream.searchParams.set("flight_iata", q.toUpperCase());
  upstream.searchParams.set("limit", String(MAX_RESULTS));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(upstream.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before searching again.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Flight data provider error.", code: "UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Flight data provider returned an invalid response.", code: "UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    if (body.error) {
      return NextResponse.json(
        { error: "Flight data provider error.", code: "UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    // Forward only the data array — never echo the access key back.
    return NextResponse.json({ data: body.data ?? [] }, { status: 200 });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = (err as Error).name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "Flight search timed out. Check your connection."
          : "Network error reaching flight data provider.",
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      },
      { status: 502 },
    );
  }
}
