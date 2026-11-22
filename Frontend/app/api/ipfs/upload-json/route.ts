import { NextRequest, NextResponse } from "next/server";
import { uploadJSON, getGatewayUrl } from "@/lib/ipfsStore";

/**
 * POST /api/ipfs/upload-json
 *
 * Body: `{ data: object, metadata?: { name?: string } }`
 *
 * #1191 – Size and complexity limits are enforced BEFORE any provider work:
 *   IPFS_MAX_BODY_BYTES   – raw request body byte cap (default 512 KiB)
 *   IPFS_MAX_NESTING_DEPTH – maximum JSON object/array nesting (default 10)
 *   IPFS_MAX_NAME_LENGTH   – metadata.name character cap (default 200)
 *
 * #1192 – Auth + quota guard:
 *   - Requests without a valid `X-Wallet-Address` header (or the equivalent
 *     server-side session token via `Authorization: Bearer <token>`) are
 *     rejected with 401 before any provider call is made.
 *   - Per-account upload quota is enforced via an in-process counter stored in
 *     `quotaStore`. When the quota is exhausted the route returns 429 and the
 *     provider is never contacted.
 *   - The quota window and limit are configurable via server-only env vars
 *     `IPFS_QUOTA_MAX` (default 50) and `IPFS_QUOTA_WINDOW_MS` (default 1 h).
 *
 * Error codes:
 * - AUTH_ERROR      — missing / invalid identity (#1192)
 * - QUOTA_EXCEEDED  — per-account upload budget exhausted (#1192)
 * - VALIDATION_ERROR — missing/invalid/oversized body (#1191)
 * - CONFIG_ERROR    — gateway misconfiguration
 * - IPFS_ERROR      — storage failure
 * - INTERNAL_ERROR  — unexpected runtime fault
 *
 * Public-read behaviour:
 *   Once uploaded, content is addressable by its CID and is readable by
 *   anyone who knows the hash. Authentication here covers write (mutation)
 *   access only; retrieval via GET /api/ipfs/retrieve/[hash] is unauthenticated
 *   because IPFS content is content-addressed and inherently public.
 */

// ---------------------------------------------------------------------------
// #1191 – Limit accessors (read dynamically so tests can override via stubEnv)
// ---------------------------------------------------------------------------

/** Maximum raw request body size in bytes (default 512 KiB). */
function getMaxBodyBytes(): number {
  return parseInt(
    process.env.IPFS_MAX_BODY_BYTES ?? String(512 * 1024),
    10
  );
}

/** Maximum JSON nesting depth (default 10). */
function getMaxNestingDepth(): number {
  return parseInt(process.env.IPFS_MAX_NESTING_DEPTH ?? "10", 10);
}

/** Maximum metadata.name length in characters (default 200). */
function getMaxNameLength(): number {
  return parseInt(process.env.IPFS_MAX_NAME_LENGTH ?? "200", 10);
}

/**
 * Measure the maximum nesting depth of a JSON value.
 * Arrays and objects each add one level; primitives are depth 0.
 */
function measureDepth(value: unknown, current = 0, limit = 10): number {
  if (current > limit) return current; // early exit
  if (Array.isArray(value)) {
    if (value.length === 0) return current + 1;
    return Math.max(...value.map((v) => measureDepth(v, current + 1, limit)));
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.values(value as Record<string, unknown>);
    if (entries.length === 0) return current + 1;
    return Math.max(
      ...entries.map((v) => measureDepth(v, current + 1, limit))
    );
  }
  return current;
}

// ---------------------------------------------------------------------------
// #1192 – In-process quota store
// ---------------------------------------------------------------------------

interface QuotaRecord {
  count: number;
  windowStart: number;
}

/** Keyed by normalised wallet address / account identifier. */
const quotaStore = new Map<string, QuotaRecord>();

/**
 * Check and increment the quota counter for `account`.
 * Reads IPFS_QUOTA_MAX and IPFS_QUOTA_WINDOW_MS dynamically so tests can
 * override them via vi.stubEnv.
 */
function checkAndIncrementQuota(
  account: string
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const quotaMax = parseInt(process.env.IPFS_QUOTA_MAX ?? "50", 10);
  const quotaWindowMs = parseInt(
    process.env.IPFS_QUOTA_WINDOW_MS ?? String(60 * 60 * 1000),
    10
  );

  const now = Date.now();
  const existing = quotaStore.get(account);

  if (!existing || now - existing.windowStart >= quotaWindowMs) {
    // New window — reset
    quotaStore.set(account, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (existing.count >= quotaMax) {
    const retryAfterMs = quotaWindowMs - (now - existing.windowStart);
    return { allowed: false, retryAfterMs };
  }

  existing.count += 1;
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// #1192 – Identity extraction
// ---------------------------------------------------------------------------

/**
 * Extract a stable account identifier from the request.
 *
 * Supported schemes (in priority order):
 *  1. `Authorization: Bearer <token>` — server-side session token; the token
 *     value is used as the account identity in this implementation.
 *  2. `X-Wallet-Address: <address>` — lightweight header set by the frontend
 *     hook after wallet connect.
 *
 * Returns the normalised account string, or `null` if no identity can be
 * derived (caller should respond with 401).
 */
function extractAccount(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token.toLowerCase();
  }

  const walletHeader = req.headers.get("x-wallet-address") ?? "";
  if (walletHeader.trim().length > 0) return walletHeader.trim().toLowerCase();

  return null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ------------------------------------------------------------------
  // #1192 – Auth guard (runs before ANY parsing or provider work)
  // ------------------------------------------------------------------
  const account = extractAccount(req);
  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Authentication required. Supply an Authorization: Bearer <token> " +
          "or X-Wallet-Address header.",
        code: "AUTH_ERROR",
      },
      { status: 401 }
    );
  }

  // ------------------------------------------------------------------
  // #1191 – Raw byte-size guard (before JSON parsing)
  // ------------------------------------------------------------------
  const maxBodyBytes = getMaxBodyBytes();
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > maxBodyBytes) {
    return NextResponse.json(
      {
        success: false,
        error: `Request body exceeds the maximum allowed size of ${maxBodyBytes} bytes`,
        code: "VALIDATION_ERROR",
        meta: { maxBodyBytes },
      },
      { status: 413 }
    );
  }

  // Read raw body and check actual byte length (content-length can be absent)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read request body",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  const actualBytes = new TextEncoder().encode(rawBody).length;
  if (actualBytes > maxBodyBytes) {
    return NextResponse.json(
      {
        success: false,
        error: `Request body exceeds the maximum allowed size of ${maxBodyBytes} bytes`,
        code: "VALIDATION_ERROR",
        meta: { maxBodyBytes, actualBytes },
      },
      { status: 413 }
    );
  }

  // ------------------------------------------------------------------
  // #1192 – Quota guard (after auth, before provider work)
  // ------------------------------------------------------------------
  const quotaResult = checkAndIncrementQuota(account);
  if (!quotaResult.allowed) {
    const quotaMax = parseInt(process.env.IPFS_QUOTA_MAX ?? "50", 10);
    const quotaWindowMs = parseInt(
      process.env.IPFS_QUOTA_WINDOW_MS ?? String(60 * 60 * 1000),
      10
    );
    return NextResponse.json(
      {
        success: false,
        error: `Upload quota exhausted. Maximum ${quotaMax} uploads per ${quotaWindowMs / 1000}s window.`,
        code: "QUOTA_EXCEEDED",
        meta: {
          quotaMax,
          windowMs: quotaWindowMs,
          retryAfterMs: quotaResult.retryAfterMs,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(quotaResult.retryAfterMs / 1000)),
        },
      }
    );
  }

  // ------------------------------------------------------------------
  // JSON parse
  // ------------------------------------------------------------------
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be valid JSON",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  if (!isPlainObject(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be a JSON object",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  const { data, metadata } = body as {
    data?: unknown;
    metadata?: { name?: unknown };
  };

  if (data === undefined || data === null) {
    return NextResponse.json(
      {
        success: false,
        error: "Data object is required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  if (typeof data !== "object") {
    return NextResponse.json(
      {
        success: false,
        error: "Data must be a JSON object or array",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  // ------------------------------------------------------------------
  // #1191 – Nesting depth guard
  // ------------------------------------------------------------------
  const maxNestingDepth = getMaxNestingDepth();
  const depth = measureDepth(data, 0, maxNestingDepth);
  if (depth > maxNestingDepth) {
    return NextResponse.json(
      {
        success: false,
        error: `Data exceeds the maximum nesting depth of ${maxNestingDepth}`,
        code: "VALIDATION_ERROR",
        meta: { maxNestingDepth, actualDepth: depth },
      },
      { status: 422 }
    );
  }

  // ------------------------------------------------------------------
  // #1191 – Metadata name length guard
  // ------------------------------------------------------------------
  const rawName =
    metadata && typeof metadata === "object" ? metadata.name : undefined;

  if (rawName !== undefined && rawName !== null) {
    if (typeof rawName !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "metadata.name must be a string",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }
    const maxNameLength = getMaxNameLength();
    if (rawName.length > maxNameLength) {
      return NextResponse.json(
        {
          success: false,
          error: `metadata.name exceeds the maximum length of ${maxNameLength} characters`,
          code: "VALIDATION_ERROR",
          meta: { maxNameLength },
        },
        { status: 422 }
      );
    }
  }

  const name = typeof rawName === "string" ? rawName : undefined;

  // ------------------------------------------------------------------
  // Provider work (only reached after all guards pass)
  // ------------------------------------------------------------------
  try {
    const hash = await uploadJSON(data, { name });
    let url: string;
    try {
      url = getGatewayUrl(hash);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "IPFS gateway is not configured",
          code: "CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "IPFS gateway returned a malformed URL",
          code: "UPSTREAM_ERROR",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { hash, url },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message, code: "IPFS_ERROR" },
      { status: 400 }
    );
  }
}
